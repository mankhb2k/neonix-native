/**
 * Buffered playback: worker + FrameBuffer + present (no live evaluate).
 */
import { describe, it, expect } from "vitest";
import {
  createPlaybackEngine,
  createFrameBuffer,
  releaseBufferedFrameData,
  type FrameConsumer,
  type FrameBufferEntry,
  type PreviewWorkerPort,
  type PresentMode,
} from "../index";
import type {
  MainToWorkerMessage,
  WorkerToMainMessage,
} from "@motionvideo/render-contracts";
import type {
  MotionRuntimeProject,
} from "@motionvideo/motion-protocol/runtime";
import type { EvaluatedCompositionFrame } from "@motionvideo/motion-runtime";

function makeRuntime(duration: number): MotionRuntimeProject {
  const transform = {
    translate: { x: 0, y: 0 },
    rotate: { z: 0 },
    scale: { x: 1, y: 1 },
    skew: { x: 0, y: 0 },
    origin: { x: 0.5, y: 0.5 },
    depth: 0,
  };
  return {
    format: "motion-runtime",
    formatVersion: 1,
    metadata: {
      id: "test",
      name: "Test",
      aspectRatio: "16:9",
      fps: 30,
      locale: "vi-VN",
      brand: { name: "Default" },
    },
    assets: [],
    layers: [
      {
        type: "group",
        id: "n1",
        parentLayerId: null,
        zIndex: 0,
        frame: { width: 100, height: 100 },
        transform,
        appearance: { visible: true, opacity: 100 },
        payload: {},
      } as MotionRuntimeProject["layers"][number],
    ],
    tracks: [],
    timeline: { duration },
  };
}

function fakeBitmap(label: string) {
  let closed = false;
  return {
    label,
    close() {
      closed = true;
    },
    get closed() {
      return closed;
    },
  };
}

function createMockWorker(opts?: { delay?: boolean }): {
  port: PreviewWorkerPort;
  flush: () => void;
  closed: string[];
} {
  let handler: ((msg: WorkerToMainMessage) => void) | null = null;
  const delayed: MainToWorkerMessage[] = [];
  const closed: string[] = [];

  const emitFrame = (msg: Extract<MainToWorkerMessage, { type: "produceFrame" }>) => {
    const bitmap = fakeBitmap(`t=${msg.time}:seq=${msg.sequenceId}`);
    const originalClose = bitmap.close.bind(bitmap);
    bitmap.close = () => {
      closed.push(bitmap.label);
      originalClose();
    };
    handler?.({
      type: "frame",
      time: msg.time,
      frame: bitmap as unknown as ImageBitmap,
      requestId: msg.requestId,
      sequenceId: msg.sequenceId,
      timings: {
        totalMs: 1,
        evaluateMs: 0.4,
        paintBuildMs: 0.1,
        painterMs: 0.4,
        encodeMs: 0.1,
        sentAt: 0,
      },
    });
  };

  const port: PreviewWorkerPort = {
    post(msg) {
      if (msg.type === "init") {
        handler?.({
          type: "ready",
          backend: "mock",
          width: 1920,
          height: 1080,
          timeOrigin: 0,
        });
        return;
      }
      if (msg.type === "produceFrame") {
        if (opts?.delay) delayed.push(msg);
        else emitFrame(msg);
      }
    },
    subscribe(next) {
      handler = next;
      return () => {
        handler = null;
      };
    },
  };

  return {
    port,
    closed,
    flush() {
      const batch = delayed.splice(0);
      for (const msg of batch) {
        if (msg.type === "produceFrame") emitFrame(msg);
      }
    },
  };
}

describe("FrameBuffer close-discipline", () => {
  it("closes evicted frames on capacity overflow", () => {
    const buf = createFrameBuffer({ capacity: 2 });
    const a = fakeBitmap("a");
    const b = fakeBitmap("b");
    const c = fakeBitmap("c");
    buf.push({ time: 0, data: a, sequenceId: 0, producedAt: 0 });
    buf.push({ time: 1, data: b, sequenceId: 0, producedAt: 0 });
    buf.push({ time: 2, data: c, sequenceId: 0, producedAt: 0 });
    expect(a.closed).toBe(true);
    expect(b.closed).toBe(false);
    expect(c.closed).toBe(false);
    buf.dispose();
    expect(b.closed).toBe(true);
    expect(c.closed).toBe(true);
  });

  it("closes stale pushed frames", () => {
    const buf = createFrameBuffer({ capacity: 8 });
    buf.setSequenceId(2);
    const stale = fakeBitmap("stale");
    buf.push({ time: 0, data: stale, sequenceId: 1, producedAt: 0 });
    expect(buf.size).toBe(0);
    expect(stale.closed).toBe(true);
    buf.dispose();
  });

  it("releaseBufferedFrameData is a no-op for plain objects", () => {
    expect(() => releaseBufferedFrameData({ frame: 1 })).not.toThrow();
    expect(() => releaseBufferedFrameData(null)).not.toThrow();
  });
});

describe("PlaybackEngine buffered worker path", () => {
  it("play fills buffer and presents without paintCompositionFrame", () => {
    const presented: number[] = [];
    const painted: EvaluatedCompositionFrame[] = [];
    const modes: PresentMode[] = [];
    const mock = createMockWorker();
    const consumer: FrameConsumer = {
      paintCompositionFrame(frame) {
        painted.push(frame);
      },
      present(entry: FrameBufferEntry) {
        presented.push(entry.time);
      },
      onPresentModeChange(mode) {
        modes.push(mode);
      },
    };
    const raf: Array<(t: number) => void> = [];
    const engine = createPlaybackEngine({
      fps: 30,
      consumer,
      worker: mock.port,
      requestFrame: (cb) => {
        raf.push(cb);
        return raf.length;
      },
      cancelFrame: () => {
        raf.length = 0;
      },
    });
    engine.load(makeRuntime(2));
    expect(engine.getPresentMode()).toBe("live");
    engine.play();
    expect(engine.playing).toBe(true);
    expect(engine.getPresentMode()).toBe("buffered");
    expect(painted).toHaveLength(0);
    expect(presented.length).toBeGreaterThan(0);
    expect(engine.getMetrics().bufferSize).toBeGreaterThan(0);
    expect(modes).toContain("buffered");
    engine.pause();
    expect(engine.getPresentMode()).toBe("live");
    expect(engine.getBufferStatus().bufferedFrames).toBe(0);
    engine.dispose();
  });

  it("pause stops top-up and drains buffer", () => {
    const mock = createMockWorker();
    const raf: Array<(t: number) => void> = [];
    const engine = createPlaybackEngine({
      fps: 30,
      consumer: { paintCompositionFrame() {} },
      worker: mock.port,
      requestFrame: (cb) => {
        raf.push(cb);
        return raf.length;
      },
      cancelFrame: () => {
        raf.length = 0;
      },
    });
    engine.load(makeRuntime(4));
    engine.play();
    expect(engine.getMetrics().bufferSize).toBeGreaterThan(0);
    engine.pause();
    expect(engine.playing).toBe(false);
    expect(engine.getBufferStatus().bufferedFrames).toBe(0);
    engine.dispose();
  });

  it("seek while playing drops in-flight stale frames", () => {
    const mock = createMockWorker({ delay: true });
    const engine = createPlaybackEngine({
      fps: 30,
      consumer: {
        paintCompositionFrame() {},
        present() {},
      },
      worker: mock.port,
      requestFrame: () => 1,
      cancelFrame: () => {},
    });
    engine.load(makeRuntime(5));
    engine.play();
    engine.seek(1);
    mock.flush();
    expect(mock.closed.length).toBeGreaterThan(0);
    expect(engine.getMetrics().droppedFrames).toBeGreaterThan(0);
    engine.dispose();
  });

  it("external clockDrive only presents on syncPlayhead", () => {
    const presented: number[] = [];
    const mock = createMockWorker();
    const engine = createPlaybackEngine({
      fps: 30,
      consumer: {
        paintCompositionFrame() {},
        present(entry) {
          presented.push(entry.time);
        },
      },
      worker: mock.port,
      clockDrive: "external",
    });
    engine.load(makeRuntime(2));
    engine.play();
    const afterPlay = presented.length;
    engine.syncPlayhead(0);
    expect(presented.length).toBeGreaterThanOrEqual(afterPlay);
    engine.syncPlayhead(0.2);
    expect(engine.currentTime).toBeCloseTo(0.2, 5);
    engine.dispose();
  });

  it("starvation keeps last presented frame (no throw)", () => {
    const mock = createMockWorker({ delay: true });
    const engine = createPlaybackEngine({
      fps: 30,
      consumer: { paintCompositionFrame() {}, present() {} },
      worker: mock.port,
      clockDrive: "external",
    });
    engine.load(makeRuntime(2));
    engine.play();
    expect(() => engine.syncPlayhead(0)).not.toThrow();
    expect(engine.getBufferStatus().starved).toBe(true);
    engine.dispose();
  });

  it("stays live until the first buffered frame arrives", () => {
    const mock = createMockWorker({ delay: true });
    const engine = createPlaybackEngine({
      fps: 30,
      consumer: { paintCompositionFrame() {}, present() {} },
      worker: mock.port,
      requestFrame: () => 1,
      cancelFrame: () => {},
    });
    engine.load(makeRuntime(2));
    engine.play();
    expect(engine.getPresentMode()).toBe("live");
    mock.flush();
    expect(engine.getPresentMode()).toBe("buffered");
    engine.dispose();
  });
});
