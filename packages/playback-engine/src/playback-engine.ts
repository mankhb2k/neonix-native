/**
 * PlaybackEngine — the canonical transport + frame scheduler.
 *
 * Live path (no worker): RAF → evaluate → paintCompositionFrame (Pixi/tests).
 * Buffered path (worker injected): RAF/host playhead → peekAt FrameBuffer →
 * present(); worker produces look-ahead frames. Used for RAM-preview play.
 *
 * The engine is framework-agnostic — no React, no DOM, no Pixi.
 */

import type {
  MotionRuntimeProject,
} from "@motionvideo/motion-protocol/runtime";
import {
  evaluateCompositionFrameV1,
  type EvaluatedCompositionFrame,
} from "@motionvideo/motion-runtime";
import {
  WORKER_PROTOCOL_VERSION,
  type ProduceFrameWorkerMsg,
  type WorkerToMainMessage,
} from "@motionvideo/render-contracts";
import { createPlaybackClock, type PlaybackClock } from "./playback-clock";
import { createQualityController, type QualityMode } from "./quality";
import { createPlaybackMetrics, type PlaybackMetricsSnapshot } from "./metrics";
import {
  createFrameBuffer,
  releaseBufferedFrameData,
  type BufferStatus,
  type FrameBuffer,
  type FrameBufferEntry,
} from "./frame-buffer";
import { createBufferPolicy } from "./buffer-policy";
import type {
  ClockDrive,
  PresentMode,
  PreviewWorkerPort,
} from "./preview-worker-port";

export type { ClockDrive, PresentMode, PreviewWorkerPort };

/** What the engine calls to paint a frame. */
export type FrameConsumer = {
  /** Paint a full composition frame. Called on every evaluated live tick. */
  paintCompositionFrame(frame: EvaluatedCompositionFrame): void;
  /** Blit a buffered bitmap during worker playback. */
  present?(entry: FrameBufferEntry): void;
  /** Host switches Pixi live vs blit canvas. */
  onPresentModeChange?(mode: PresentMode): void;
  /** Called when the engine wants the consumer to render a specific frame at a time. */
  renderFrameAt?(time: number): void;
};

export type PlaybackEngineOptions = {
  /** FPS for the composition timeline. */
  fps: number;
  /** Consumer that paints frames (Pixi, Remotion, blit presenter, test mock). */
  consumer: FrameConsumer;
  /** RAF injection (for testing). */
  requestFrame?: (cb: (time: number) => void) => number;
  /** cancelAnimationFrame injection (for testing). */
  cancelFrame?: (id: number) => void;
  /** AudioContext for hardware clock (optional). */
  audioContext?: AudioContext | null;
  /** Initial quality mode. */
  quality?: QualityMode;
  /** Callback on unsupported/starvation warnings. */
  onWarning?: (msg: string) => void;
  /** When set, play() uses worker look-ahead + FrameBuffer present. */
  worker?: PreviewWorkerPort;
  /**
   * `internal` (default): engine clock + RAF.
   * `external`: host calls syncPlayhead() from its own clock (web Zustand).
   */
  clockDrive?: ClockDrive;
  /** Buffer look-ahead target in seconds. */
  bufferTargetSec?: number;
  /** Max in-flight produce requests. */
  maxInflight?: number;
  /** Injected monotonic clock (tests). */
  getMonotonicTime?: () => number;
};

export type PlaybackEngine = {
  load(runtime: MotionRuntimeProject): void;
  applyPatch(patch: { type: string; [key: string]: unknown }): void;
  play(): void;
  pause(): void;
  seek(time: number): void;
  setRate(rate: number): void;
  setLoop(loop: boolean): void;
  setQuality(mode: QualityMode): void;
  renderFrameAt(time: number): EvaluatedCompositionFrame | null;
  /**
   * Host-driven playhead (clockDrive: "external").
   * When playing + worker: present + top-up. When paused: no-op (host Pixi).
   */
  syncPlayhead(time: number): void;
  getMetrics(): PlaybackMetricsSnapshot;
  getPresentMode(): PresentMode;
  getBufferStatus(): BufferStatus;
  readonly playing: boolean;
  readonly currentTime: number;
  readonly currentFrame: number;
  readonly duration: number;
  dispose(): void;
};

function compositionSize(runtime: MotionRuntimeProject): {
  width: number;
  height: number;
} {
  const w = runtime.composition?.width;
  const h = runtime.composition?.height;
  if (typeof w === "number" && typeof h === "number" && w > 0 && h > 0) {
    return { width: w, height: h };
  }
  if (runtime.metadata.aspectRatio === "9:16") {
    return { width: 1080, height: 1920 };
  }
  return { width: 1920, height: 1080 };
}

export function createPlaybackEngine(
  opts: PlaybackEngineOptions,
): PlaybackEngine {
  const consumer = opts.consumer;
  const worker = opts.worker;
  const clockDrive: ClockDrive = opts.clockDrive ?? "internal";
  let fps = Math.max(1, opts.fps);
  const requestFrame =
    opts.requestFrame ??
    ((cb: FrameRequestCallback) => requestAnimationFrame(cb));
  const cancelFrame =
    opts.cancelFrame ?? ((id: number) => cancelAnimationFrame(id));
  const quality = createQualityController(opts.quality);
  const metrics = createPlaybackMetrics();
  const policy = createBufferPolicy({
    targetSec: opts.bufferTargetSec ?? 3,
    maxInflight: opts.maxInflight ?? 4,
    fps,
  });
  const buffer: FrameBuffer = createFrameBuffer({
    capacity: policy.getBufferCapacity(),
    targetSec: opts.bufferTargetSec ?? 3,
  });

  let runtime: MotionRuntimeProject | null = null;
  let duration = 0;
  let loop = false;
  let sequenceId = 0;
  let lastPaintedFrame = -1;
  let lastPresentedTime = Number.NaN;
  let rafId = 0;
  let playing = false;
  let presentMode: PresentMode = "live";
  let workerReady = false;
  let initialized = false;
  let nextRequestId = 1;
  let highestQueuedFrame = -1;
  const inflight = new Map<number, { time: number; sequenceId: number }>();
  let unsubscribeWorker: (() => void) | null = null;
  let externalPlayhead = 0;

  let clock: PlaybackClock = createPlaybackClock({
    fps,
    duration: 0,
    audioContext: opts.audioContext,
    getMonotonicTime: opts.getMonotonicTime,
  });

  const playheadTime = (): number =>
    clockDrive === "external" ? externalPlayhead : clock.currentTime();

  const setPresentMode = (next: PresentMode) => {
    if (presentMode === next) return;
    presentMode = next;
    consumer.onPresentModeChange?.(next);
  };

  const bumpSequence = () => {
    sequenceId += 1;
    buffer.setSequenceId(sequenceId);
    // Keep inflight entries until the worker replies so maxInflight still
    // counts in-flight paints after seek/load. Stale bitmaps are dropped
    // in onWorkerMessage.
    highestQueuedFrame = -1;
    lastPresentedTime = Number.NaN;
  };

  const postProduce = (time: number, qualityTier: "realtime" | "final") => {
    if (!worker || !workerReady) return;
    const requestId = nextRequestId++;
    inflight.set(requestId, { time, sequenceId });
    const msg: ProduceFrameWorkerMsg = {
      type: "produceFrame",
      time,
      quality: qualityTier,
      requestId,
      sequenceId,
    };
    worker.post(msg);
  };

  const maybeTopUp = () => {
    if (!playing || !worker || !workerReady || !runtime) return;
    const playhead = playheadTime();
    const playFrame = Math.max(0, Math.round(playhead * fps));
    let guard = 0;
    while (guard < 64) {
      guard += 1;
      const ahead = buffer.aheadSec(playhead);
      if (!policy.shouldTopUp(ahead, inflight.size)) break;
      let frame = playFrame;
      if (highestQueuedFrame >= playFrame) frame = highestQueuedFrame + 1;
      const t = frame / fps;
      if (t > duration + 1e-9) break;
      highestQueuedFrame = frame;
      postProduce(t, "realtime");
    }
  };

  const presentBuffered = () => {
    const playhead = playheadTime();
    const entry = buffer.peekAt(playhead);
    if (!entry) {
      metrics.starved();
      if (policy.recordStarvation()) {
        opts.onWarning?.("preview buffer starved");
      }
      metrics.setBufferSize(buffer.size);
      return;
    }
    policy.resetStarvation();
    if (entry.time !== lastPresentedTime) {
      const t0 = performance.now();
      setPresentMode("buffered");
      consumer.present?.(entry);
      metrics.recordFrame(0, performance.now() - t0);
      lastPresentedTime = entry.time;
    }
    buffer.prune(playhead);
    metrics.setBufferSize(buffer.size);
  };

  const onWorkerMessage = (msg: WorkerToMainMessage) => {
    if (msg.type === "ready") {
      workerReady = true;
      maybeTopUp();
      return;
    }
    if (msg.type === "error") {
      opts.onWarning?.(msg.message);
      return;
    }
    if (msg.type === "frameError") {
      inflight.delete(msg.requestId);
      if (msg.sequenceId === sequenceId) {
        metrics.dropped();
        opts.onWarning?.(msg.error);
      }
      maybeTopUp();
      return;
    }
    if (msg.type !== "frame") return;
    inflight.delete(msg.requestId);
    if (msg.sequenceId !== sequenceId) {
      releaseBufferedFrameData(msg.frame);
      metrics.dropped();
      return;
    }
    buffer.push({
      time: msg.time,
      data: msg.frame,
      sequenceId: msg.sequenceId,
      producedAt: performance.now(),
    });
    metrics.setBufferSize(buffer.size);
    if (playing) {
      presentBuffered();
      maybeTopUp();
    }
  };

  if (worker) {
    unsubscribeWorker = worker.subscribe(onWorkerMessage);
  }

  const postRuntime = (next: MotionRuntimeProject) => {
    if (!worker) return;
    const size = compositionSize(next);
    const runtimeJson = JSON.stringify(next);
    if (!initialized) {
      worker.post({
        type: "init",
        protocolVersion: WORKER_PROTOCOL_VERSION,
        runtimeJson,
        width: size.width,
        height: size.height,
        fps,
        sequenceId,
      });
      initialized = true;
    } else {
      worker.post({
        type: "setSource",
        runtimeJson,
        sequenceId,
      });
    }
  };

  const renderCurrentFrame = (): EvaluatedCompositionFrame | null => {
    if (!runtime) return null;

    const t0 = performance.now();
    const frame = clock.currentFrame();
    const scale = quality.getResolutionScale();
    const size = compositionSize(runtime);
    const w = Math.round(size.width * scale);
    const h = Math.round(size.height * scale);

    let result: EvaluatedCompositionFrame | null = null;
    try {
      result = evaluateCompositionFrameV1(runtime, frame, fps, w, h);
    } catch (err) {
      opts.onWarning?.(
        err instanceof Error ? err.message : "evaluateCompositionFrame failed",
      );
      metrics.starved();
      return null;
    }

    const evalMs = performance.now() - t0;

    if (!result) {
      metrics.starved();
      return null;
    }

    const paintT0 = performance.now();
    consumer.paintCompositionFrame(result);
    const paintMs = performance.now() - paintT0;

    metrics.recordFrame(evalMs, paintMs);
    if (!worker) metrics.setBufferSize(0);

    lastPaintedFrame = frame;
    return result;
  };

  const stopRaf = () => {
    if (rafId !== 0) {
      cancelFrame(rafId);
      rafId = 0;
    }
  };

  const tick = (_rafTime: number) => {
    metrics.tick();

    if (!playing) return;
    if (!runtime) {
      metrics.starved();
      return;
    }

    const time = playheadTime();

    if (time >= duration) {
      if (loop) {
        if (clockDrive === "internal") clock.seek(0);
        bumpSequence();
        policy.setMode("playing");
        maybeTopUp();
      } else {
        clock.pause();
        playing = false;
        policy.setMode("paused");
        setPresentMode("live");
        if (!worker && quality.consumeRefineNeeded()) {
          renderCurrentFrame();
        }
        return;
      }
    }

    if (worker) {
      presentBuffered();
      maybeTopUp();
    } else {
      const frame = clock.currentFrame();
      if (frame !== lastPaintedFrame) {
        renderCurrentFrame();
      }
    }

    if (playing && clockDrive === "internal") {
      rafId = requestFrame(tick);
    }
  };

  const engine: PlaybackEngine = {
    load(next: MotionRuntimeProject) {
      const reloading = runtime !== null;
      runtime = next;
      duration = next.timeline.duration;
      if (typeof next.metadata.fps === "number" && next.metadata.fps > 0) {
        fps = Math.max(1, next.metadata.fps);
      }
      if (!reloading) {
        clock = createPlaybackClock({
          fps,
          duration,
          audioContext: opts.audioContext,
          getMonotonicTime: opts.getMonotonicTime,
        });
        clock.seek(0);
        externalPlayhead = 0;
        lastPaintedFrame = -1;
      } else {
        clock = createPlaybackClock({
          fps,
          duration,
          audioContext: opts.audioContext,
          getMonotonicTime: opts.getMonotonicTime,
        });
        clock.seek(externalPlayhead);
      }
      bumpSequence();
      metrics.reset();
      policy.reset();
      policy.setMode(playing ? "playing" : "paused");
      if (!playing || !worker) setPresentMode("live");
      postRuntime(next);
      if (playing && worker) maybeTopUp();
    },

    applyPatch(_patch: { type: string; [key: string]: unknown }) {
      bumpSequence();
      if (runtime) postRuntime(runtime);
    },

    play() {
      if (!runtime) return;
      playing = true;
      quality.setMode("playback");
      policy.setMode("playing");
      if (worker) {
        maybeTopUp();
      }
      if (clockDrive === "internal") {
        clock.play();
        rafId = requestFrame(tick);
      }
    },

    pause() {
      playing = false;
      clock.pause();
      stopRaf();
      policy.setMode("paused");
      bumpSequence();
      setPresentMode("live");
      if (!worker && quality.consumeRefineNeeded()) {
        renderCurrentFrame();
      }
    },

    seek(time: number) {
      const clampedTime = Math.min(duration, Math.max(0, time));
      clock.seek(clampedTime);
      externalPlayhead = clampedTime;
      bumpSequence();
      lastPaintedFrame = -1;

      if (playing && worker) {
        maybeTopUp();
        return;
      }
      if (!playing && !worker) {
        renderCurrentFrame();
      }
    },

    setRate(rate: number) {
      clock.setRate(rate);
      bumpSequence();
    },

    setLoop(shouldLoop: boolean) {
      loop = shouldLoop;
    },

    setQuality(mode: QualityMode) {
      quality.setMode(mode);
    },

    renderFrameAt(time: number): EvaluatedCompositionFrame | null {
      const clampedTime = Math.min(duration, Math.max(0, time));
      clock.seek(clampedTime);
      externalPlayhead = clampedTime;
      if (!worker) {
        bumpSequence();
        lastPaintedFrame = -1;
      }
      return renderCurrentFrame();
    },

    syncPlayhead(time: number) {
      const clampedTime = Math.min(duration, Math.max(0, time));
      externalPlayhead = clampedTime;
      if (!playing || !worker) return;
      metrics.tick();
      if (clampedTime >= duration && !loop) {
        engine.pause();
        return;
      }
      presentBuffered();
      maybeTopUp();
    },

    getMetrics() {
      return metrics.snapshot();
    },

    getPresentMode() {
      return presentMode;
    },

    getBufferStatus() {
      return buffer.status(playheadTime(), fps);
    },

    get playing() {
      return playing;
    },

    get currentTime() {
      return playheadTime();
    },

    get currentFrame() {
      return Math.round(playheadTime() * fps);
    },

    get duration() {
      return duration;
    },

    dispose() {
      playing = false;
      stopRaf();
      unsubscribeWorker?.();
      unsubscribeWorker = null;
      if (worker && initialized) {
        worker.post({ type: "dispose", sequenceId });
      }
      buffer.dispose();
      clock.dispose();
      runtime = null;
      inflight.clear();
    },
  };

  return engine;
}
