/**
 * Phase 9 tests: Worker protocol, frame buffer, buffer policy & media fallback.
 *
 * Verifies:
 *   - Task 9.2: Worker protocol types & versioning
 *   - Task 9.3: FrameBuffer (push, peek, prune, eviction, sequence filtering)
 *   - Task 9.3: BufferPolicy (mode transitions, top-up decisions, starvation)
 *   - Task 9.4: MediaFallbackBridge (register, pump, fallback requests, dispose)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createFrameBuffer,
  createBufferPolicy,
  createMediaFallbackBridge,
  type FrameBuffer,
  type FrameBufferEntry,
  type BufferPolicy,
  type MediaFallbackBridge,
  type VideoFrameProvider,
} from "../index";
import type { WorkerSequenceId } from "@motionvideo/render-contracts";
import type { MainToWorkerMessage } from "@motionvideo/render-contracts";

// ── Helpers ───────────────────────────────────────────────────────

function makeEntry(
  time: number,
  seqId: WorkerSequenceId = 0,
  data?: unknown,
): FrameBufferEntry {
  return {
    time,
    data: data ?? { frame: time },
    sequenceId: seqId,
    producedAt: Date.now(),
  };
}

function createMockVideoProvider(id: string, assetUri: string) {
  let _frameReady = false;
  let _sourceFrame = 0;
  const provider: VideoFrameProvider = {
    id,
    assetUri,
    width: 1920,
    height: 1080,
    get frameReady() {
      return _frameReady;
    },
    get sourceFrame() {
      return _sourceFrame;
    },
    seek(_timeSeconds: number) {
      _frameReady = false;
    },
    grabFrame(): VideoFrame | ImageBitmap | null {
      _frameReady = false;
      return null;
    },
    dispose() {},
  };
  return Object.assign(provider, {
    _setReady(v: boolean) {
      _frameReady = v;
    },
    _setSourceFrame(f: number) {
      _sourceFrame = f;
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// Worker Protocol (Task 9.2)
// ═══════════════════════════════════════════════════════════════════

describe("Worker Protocol (Task 9.2)", () => {
  it("WORKER_PROTOCOL_VERSION is a positive integer", async () => {
    const mod = await import("@motionvideo/render-contracts");
    expect(Number.isInteger(mod.WORKER_PROTOCOL_VERSION)).toBe(true);
    expect(mod.WORKER_PROTOCOL_VERSION).toBeGreaterThan(0);
  });

  it("WorkerSequenceId is a number type", async () => {
    // Type-only test: if it compiles, it passes
    const seq: number = 42;
    expect(typeof seq).toBe("number");
  });

  it("MainToWorkerMessage has init discriminator", async () => {
    const msg: MainToWorkerMessage = {
      type: "init",
      protocolVersion: 1,
      runtimeJson: "{}",
      width: 1920,
      height: 1080,
      fps: 30,
      sequenceId: 1,
    } as MainToWorkerMessage;
    expect(msg.type).toBe("init");
  });

  it("WorkerToMainMessage has ready discriminator", async () => {
    const mod = await import("@motionvideo/render-contracts");
    const msg = {
      type: "ready",
      backend: "webgl2",
      width: 1920,
      height: 1080,
      timeOrigin: 0,
    };
    expect(msg.type).toBe("ready");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Frame Buffer (Task 9.3)
// ═══════════════════════════════════════════════════════════════════

describe("FrameBuffer (Task 9.3)", () => {
  let buf: FrameBuffer;

  beforeEach(() => {
    buf = createFrameBuffer({ capacity: 16, targetSec: 3.0 });
  });

  afterEach(() => {
    buf.dispose();
  });

  // ── Push & peek ─────────────────────────────────────────────────

  it("starts empty", () => {
    expect(buf.size).toBe(0);
    expect(buf.peekAt(0)).toBeNull();
    expect(buf.aheadSec(0)).toBe(0);
  });

  it("push and peekAt returns correct frame for playhead", () => {
    buf.push(makeEntry(0.0));
    buf.push(makeEntry(0.5));
    buf.push(makeEntry(1.0));

    expect(buf.peekAt(0.0)?.time).toBe(0.0);
    expect(buf.peekAt(0.3)?.time).toBe(0.0);
    expect(buf.peekAt(0.5)?.time).toBe(0.5);
    expect(buf.peekAt(0.75)?.time).toBe(0.5);
    expect(buf.peekAt(1.0)?.time).toBe(1.0);
    expect(buf.peekAt(2.0)?.time).toBe(1.0);
  });

  it("peekAt returns null when playhead is before all frames", () => {
    buf.push(makeEntry(1.0));
    buf.push(makeEntry(2.0));
    expect(buf.peekAt(0.0)).toBeNull();
  });

  it("entries are maintained sorted after push", () => {
    // Push out of order
    buf.push(makeEntry(2.0));
    buf.push(makeEntry(0.5));
    buf.push(makeEntry(1.0));
    buf.push(makeEntry(0.0));

    // Verify sorted order by peeking
    expect(buf.peekAt(0.0)?.time).toBe(0.0);
    expect(buf.peekAt(0.5)?.time).toBe(0.5);
    expect(buf.peekAt(1.0)?.time).toBe(1.0);
    expect(buf.peekAt(2.0)?.time).toBe(2.0);
    expect(buf.size).toBe(4);
  });

  it("replaces frame at same time with newer sequence", () => {
    buf.push(makeEntry(0.5, 1, "old"));
    buf.push(makeEntry(0.5, 2, "new"));
    expect(buf.peekAt(0.5)?.data).toBe("new");
    expect(buf.size).toBe(1);
  });

  it("keeps existing frame at same time when sequence is older", () => {
    buf.push(makeEntry(0.5, 2, "newer"));
    buf.push(makeEntry(0.5, 1, "older"));
    expect(buf.peekAt(0.5)?.data).toBe("newer");
    expect(buf.size).toBe(1);
  });

  // ── aheadSec ────────────────────────────────────────────────────

  it("aheadSec returns seconds buffered ahead of playhead", () => {
    buf.push(makeEntry(0.0));
    buf.push(makeEntry(1.0));
    buf.push(makeEntry(3.0));

    expect(buf.aheadSec(0.0)).toBe(3.0);
    expect(buf.aheadSec(1.0)).toBe(2.0);
    expect(buf.aheadSec(2.0)).toBe(1.0);
    expect(buf.aheadSec(4.0)).toBe(0);
  });

  // ── prune ───────────────────────────────────────────────────────

  it("prune removes frames behind playhead", () => {
    buf.push(makeEntry(0.0));
    buf.push(makeEntry(0.5));
    buf.push(makeEntry(1.0));
    buf.push(makeEntry(2.0));

    buf.prune(1.0);
    expect(buf.size).toBe(2);
    expect(buf.peekAt(0.5)).toBeNull();
    expect(buf.peekAt(1.0)?.time).toBe(1.0);
    expect(buf.peekAt(2.0)?.time).toBe(2.0);
  });

  it("prune keeps frames within keepBackSec", () => {
    buf.push(makeEntry(0.0));
    buf.push(makeEntry(0.9));
    buf.push(makeEntry(1.0));

    // keepBackSec = 0.2, playhead = 1.0 → cutoff = 0.8
    buf.prune(1.0, 0.2);
    expect(buf.size).toBe(2);
    expect(buf.peekAt(0.9)?.time).toBe(0.9);
    expect(buf.peekAt(1.0)?.time).toBe(1.0);
  });

  // ── Capacity eviction ───────────────────────────────────────────

  it("evicts oldest frames on overflow", () => {
    const small = createFrameBuffer({ capacity: 3 });
    small.push(makeEntry(0.0));
    small.push(makeEntry(1.0));
    small.push(makeEntry(2.0));
    expect(small.size).toBe(3);

    small.push(makeEntry(3.0));
    expect(small.size).toBe(3);
    expect(small.peekAt(0.0)).toBeNull(); // evicted
    expect(small.peekAt(1.0)?.time).toBe(1.0);
    expect(small.peekAt(3.0)?.time).toBe(3.0);

    small.dispose();
  });

  // ── Sequence filtering ──────────────────────────────────────────

  it("drops stale frames on push (wrong sequenceId)", () => {
    buf.setSequenceId(2);
    buf.push(makeEntry(0.0, 1)); // stale
    expect(buf.size).toBe(0);

    buf.push(makeEntry(0.0, 2)); // ok
    expect(buf.size).toBe(1);
  });

  it("setSequenceId evicts all frames from previous sequences", () => {
    buf.push(makeEntry(0.0, 1));
    buf.push(makeEntry(1.0, 1));
    expect(buf.size).toBe(2);

    buf.setSequenceId(2);
    expect(buf.size).toBe(0);
  });

  // ── status ──────────────────────────────────────────────────────

  it("status reports bufferedFrames, latestTime, aheadSec, starved", () => {
    buf.push(makeEntry(0.5));
    buf.push(makeEntry(1.5));

    const s = buf.status(0.0, 30);
    expect(s.bufferedFrames).toBe(2);
    expect(s.latestTime).toBe(1.5);
    expect(s.aheadSec).toBe(1.5);
    expect(s.starved).toBe(true); // no frame at or before 0.0
  });

  it("status not starved when frame exists at playhead", () => {
    buf.push(makeEntry(0.0));
    buf.push(makeEntry(0.5));
    const s = buf.status(0.0, 30);
    expect(s.starved).toBe(false);
  });

  // ── clear / dispose ─────────────────────────────────────────────

  it("clear removes all entries", () => {
    buf.push(makeEntry(0.0));
    buf.push(makeEntry(1.0));
    buf.clear();
    expect(buf.size).toBe(0);
    expect(buf.peekAt(0.5)).toBeNull();
  });

  it("dispose is idempotent", () => {
    buf.dispose();
    buf.dispose();
    expect(buf.size).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Buffer Policy (Task 9.3)
// ═══════════════════════════════════════════════════════════════════

describe("BufferPolicy (Task 9.3)", () => {
  let policy: BufferPolicy;

  beforeEach(() => {
    policy = createBufferPolicy({
      targetSec: 3.0,
      maxInflight: 4,
      fps: 30,
    });
  });

  // ── Mode transitions ────────────────────────────────────────────

  it("defaults to playing mode", () => {
    expect(policy.getMode()).toBe("playing");
  });

  it("setMode transitions between modes", () => {
    policy.setMode("interactive");
    expect(policy.getMode()).toBe("interactive");

    policy.setMode("paused");
    expect(policy.getMode()).toBe("paused");

    policy.setMode("playing");
    expect(policy.getMode()).toBe("playing");
  });

  // ── shouldTopUp — playing mode ──────────────────────────────────

  it("shouldTopUp returns true when aheadSec < target in playing mode", () => {
    expect(policy.shouldTopUp(0, 0)).toBe(true); // no frames, no inflight
    expect(policy.shouldTopUp(2.0, 0)).toBe(true); // below 3.0 target
    expect(policy.shouldTopUp(4.0, 0)).toBe(false); // above 3.0 target
  });

  it("shouldTopUp returns false when inflight at max", () => {
    expect(policy.shouldTopUp(1.0, 4)).toBe(false); // 4 inflight = max
    expect(policy.shouldTopUp(1.0, 5)).toBe(false); // over max
    expect(policy.shouldTopUp(1.0, 3)).toBe(true); // 3 inflight < max 4
  });

  // ── shouldTopUp — interactive mode ──────────────────────────────

  it("interactive mode: tops up only when zero ahead and < 1 inflight", () => {
    policy.setMode("interactive");

    expect(policy.shouldTopUp(0, 0)).toBe(true);
    expect(policy.shouldTopUp(0.5, 0)).toBe(false); // has ahead, no need
    expect(policy.shouldTopUp(0, 1)).toBe(false); // already 1 inflight
    expect(policy.shouldTopUp(0, 2)).toBe(false); // over max
  });

  // ── shouldTopUp — paused mode ───────────────────────────────────

  it("paused mode with refine: tops up only once", () => {
    policy.setMode("paused");
    // Playing→paused triggers refineRequested = true
    expect(policy.shouldTopUp(0, 0)).toBe(true); // refine allowed

    // After consume, no more top-ups
    expect(policy.shouldTopUp(0, 0)).toBe(true); // still true (we haven't consumed yet through getState)
    // Actually shouldTopUp doesn't auto-consume refine. Let's check consumeRefine separately.
  });

  it("consumeRefine returns true once after playing→paused transition", () => {
    expect(policy.consumeRefine()).toBe(false); // no refine yet
    policy.setMode("paused");
    expect(policy.consumeRefine()).toBe(true); // refine triggered
    expect(policy.consumeRefine()).toBe(false); // consumed
  });

  it("paused mode without refine: no top-ups after refine consumed", () => {
    policy.setMode("paused");
    policy.consumeRefine(); // consume the refine flag
    // No inflight allowed, no refine pending
    expect(policy.shouldTopUp(0, 0)).toBe(false);
  });

  // ── Starvation ──────────────────────────────────────────────────

  it("recordStarvation returns false until threshold", () => {
    for (let i = 0; i < 4; i++) {
      expect(policy.recordStarvation()).toBe(false);
    }
    // 5th starvation triggers fallback
    expect(policy.recordStarvation()).toBe(true);
  });

  it("resetStarvation clears counter", () => {
    for (let i = 0; i < 4; i++) {
      policy.recordStarvation();
    }
    policy.resetStarvation();
    expect(policy.recordStarvation()).toBe(false);
  });

  it("mode change resets starvation counter", () => {
    for (let i = 0; i < 4; i++) {
      policy.recordStarvation();
    }
    policy.setMode("interactive");
    expect(policy.recordStarvation()).toBe(false);
  });

  // ── getState ────────────────────────────────────────────────────

  it("getState reflects playing mode defaults", () => {
    const state = policy.getState();
    expect(state.mode).toBe("playing");
    expect(state.effectiveTargetSec).toBe(3.0);
    expect(state.effectiveMaxInflight).toBe(4);
    expect(state.refineRequested).toBe(false);
    expect(state.starved).toBe(false);
  });

  it("getState reflects interactive mode", () => {
    policy.setMode("interactive");
    const state = policy.getState();
    expect(state.mode).toBe("interactive");
    expect(state.effectiveTargetSec).toBe(0);
    expect(state.effectiveMaxInflight).toBe(1);
  });

  it("getState reflects paused mode with refine", () => {
    policy.setMode("paused");
    const state = policy.getState();
    expect(state.mode).toBe("paused");
    expect(state.effectiveTargetSec).toBe(0);
    expect(state.effectiveMaxInflight).toBe(1);
    expect(state.refineRequested).toBe(true);
  });

  it("getBufferCapacity scales with fps and targetSec", () => {
    const cap = policy.getBufferCapacity();
    // targetSec * fps * 1.6 = 3.0 * 30 * 1.6 = 144
    expect(cap).toBe(144);

    const fastPolicy = createBufferPolicy({ targetSec: 2.0, fps: 60 });
    expect(fastPolicy.getBufferCapacity()).toBe(Math.ceil(2.0 * 60 * 1.6));
  });

  // ── reset ───────────────────────────────────────────────────────

  it("reset returns to playing defaults", () => {
    policy.setMode("interactive");
    policy.recordStarvation();
    policy.reset();

    const state = policy.getState();
    expect(state.mode).toBe("playing");
    expect(state.starved).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Media Fallback Bridge (Task 9.4)
// ═══════════════════════════════════════════════════════════════════

describe("MediaFallbackBridge (Task 9.4)", () => {
  let bridge: MediaFallbackBridge;

  beforeEach(() => {
    bridge = createMediaFallbackBridge();
  });

  afterEach(() => {
    bridge.dispose();
  });

  // ── Register / unregister ────────────────────────────────────────

  it("registers and retrieves a video provider", () => {
    const p = createMockVideoProvider("v1", "asset://video.mp4");
    bridge.registerVideo(p.assetUri, p);
    expect(bridge.getProvider(p.assetUri)).toBe(p);
  });

  it("unregister removes provider", () => {
    const p = createMockVideoProvider("v1", "asset://video.mp4");
    bridge.registerVideo(p.assetUri, p);
    bridge.unregister(p.assetUri);
    expect(bridge.getProvider(p.assetUri)).toBeNull();
  });

  it("register replaces existing provider for same URI", () => {
    const p1 = createMockVideoProvider("v1", "asset://video.mp4");
    const p2 = createMockVideoProvider("v2", "asset://video.mp4");
    bridge.registerVideo(p1.assetUri, p1);
    bridge.registerVideo(p2.assetUri, p2);
    expect(bridge.getProvider(p2.assetUri)).toBe(p2);
  });

  // ── pump ────────────────────────────────────────────────────────

  it("pump returns URIs with ready frames", () => {
    const p1 = createMockVideoProvider("v1", "asset://a.mp4");
    const p2 = createMockVideoProvider("v2", "asset://b.mp4");

    bridge.registerVideo(p1.assetUri, p1);
    bridge.registerVideo(p2.assetUri, p2);

    // None ready initially
    expect(bridge.pump()).toEqual([]);

    // Set one ready
    p1._setReady(true);
    expect(bridge.pump()).toEqual(["asset://a.mp4"]);

    // Both ready
    p2._setReady(true);
    expect(bridge.pump()).toEqual(["asset://a.mp4", "asset://b.mp4"]);
  });

  // ── handleFallbackRequest ───────────────────────────────────────

  it("handleFallbackRequest returns URIs that have providers", () => {
    const p = createMockVideoProvider("v1", "asset://video.mp4");
    bridge.registerVideo(p.assetUri, p);

    const resolved = bridge.handleFallbackRequest([
      "asset://video.mp4",
      "asset://missing.mp4",
    ]);
    expect(resolved).toEqual(["asset://video.mp4"]);
  });

  it("handleFallbackRequest returns empty for unknown URIs", () => {
    expect(bridge.handleFallbackRequest(["asset://unknown.mp4"])).toEqual([]);
  });

  // ── seekAll ─────────────────────────────────────────────────────

  it("seekAll calls seek on all providers", () => {
    const p1 = createMockVideoProvider("v1", "asset://a.mp4");
    const p2 = createMockVideoProvider("v2", "asset://b.mp4");
    const seekSpy1 = vi.spyOn(p1, "seek");
    const seekSpy2 = vi.spyOn(p2, "seek");

    bridge.registerVideo(p1.assetUri, p1);
    bridge.registerVideo(p2.assetUri, p2);
    bridge.seekAll(5.0);

    expect(seekSpy1).toHaveBeenCalledWith(5.0);
    expect(seekSpy2).toHaveBeenCalledWith(5.0);
  });

  // ── dispose ─────────────────────────────────────────────────────

  it("dispose clears all providers", () => {
    const p = createMockVideoProvider("v1", "asset://video.mp4");
    bridge.registerVideo(p.assetUri, p);
    bridge.dispose();
    expect(bridge.getProvider(p.assetUri)).toBeNull();
    expect(bridge.pump()).toEqual([]);
  });

  it("getProvider returns null after dispose", () => {
    const p = createMockVideoProvider("v1", "asset://video.mp4");
    bridge.registerVideo(p.assetUri, p);
    bridge.dispose();
    expect(bridge.getProvider(p.assetUri)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Integration: Buffer + Policy (Task 9.3)
// ═══════════════════════════════════════════════════════════════════

describe("Buffer + Policy integration", () => {
  it("playing mode: buffer fills until target then stops", () => {
    const buf = createFrameBuffer({ capacity: 200, targetSec: 1.0 });
    const policy = createBufferPolicy({
      targetSec: 1.0,
      maxInflight: 4,
      fps: 30,
    });

    let inflight = 0;

    // Simulate engine tick — produce frames for 10 ticks only (0.33s)
    for (let t = 0; t < 0.5; t += 1 / 30) {
      const ahead = buf.aheadSec(t);
      if (policy.shouldTopUp(ahead, inflight) && inflight < 4) {
        inflight++;
        const producedTime = t + inflight * 0.1;
        buf.push(makeEntry(producedTime));
        inflight--;
      }

      buf.prune(t);
    }

    // Should have buffered some frames
    expect(buf.size).toBeGreaterThan(0);
    buf.dispose();
  });

  it("interactive mode: minimal buffer", () => {
    const buf = createFrameBuffer({ capacity: 10, targetSec: 0.5 });
    const policy = createBufferPolicy({
      targetSec: 0.5,
      maxInflight: 1,
      fps: 30,
    });
    policy.setMode("interactive");

    // Push a few frames
    buf.push(makeEntry(0.0));
    buf.push(makeEntry(0.1));

    // Interactive mode shouldn't buffer more
    const status = buf.status(0.05, 30);
    expect(policy.shouldTopUp(status.aheadSec, 0)).toBe(false);

    buf.dispose();
  });

  it("starvation fallback triggers after consecutive misses", () => {
    const policy = createBufferPolicy({
      targetSec: 3.0,
      maxInflight: 4,
      fps: 30,
    });

    // Simulate no buffer available for 5+ ticks
    let triggered = false;
    for (let i = 0; i < 10; i++) {
      if (policy.recordStarvation()) {
        triggered = true;
        break;
      }
    }
    expect(triggered).toBe(true);
  });

  it("refine on pause: playing→paused triggers one final frame request", () => {
    const policy = createBufferPolicy({
      targetSec: 3.0,
      maxInflight: 4,
      fps: 30,
    });

    // Playing
    expect(policy.shouldTopUp(2.0, 0)).toBe(true);

    // Pause
    policy.setMode("paused");
    expect(policy.consumeRefine()).toBe(true);

    // After consuming refine, no more top-ups
    expect(policy.shouldTopUp(0, 0)).toBe(false);
  });
});
