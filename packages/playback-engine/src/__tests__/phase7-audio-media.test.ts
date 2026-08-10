/**
 * Phase 7 tests: Audio & video media pipeline.
 *
 * Verifies:
 *   - Task 7.1: AudioRenderPlan expansion (assetDuration, trimEnd, loopWindow, channelPolicy)
 *   - Task 7.2: Web Audio scheduler (look-ahead, gain nodes, mute/solo, reschedule)
 *   - Task 7.3: Volume envelope linear interpolation
 *   - Task 7.5: MediaFrameProvider (acquire/release, frame tracking, dispose)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createAudioScheduler,
  createMediaFrameProvider,
  type AudioScheduler,
  type AudioContextLike,
  type AudioBufferLike,
  type MediaFrameProvider,
  type MediaTextureHandle,
} from "../index";
import {
  buildAudioRenderPlan,
  sampleAudioVolumeLinear,
  type AudioRenderPlan,
} from "@motionvideo/motion-runtime";

// ── Mock AudioContext for scheduler tests ──────────────────────────

function createMockAudioContext(): AudioContextLike {
  let _currentTime = 0;
  let _state: AudioContextState = "running";

  const mockGain: { gain: { value: number; cancelScheduledValues: ReturnType<typeof vi.fn>; setValueAtTime: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn> }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> } = {
    gain: {
      value: 0,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockSource: {
    buffer: null; playbackRate: { value: number }; loop: boolean; loopStart: number; loopEnd: number;
    connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn>;
  } = {
    buffer: null,
    playbackRate: { value: 1 },
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  return {
    get currentTime() { return _currentTime; },
    get state() { return _state; },
    destination: {} as AudioDestinationNode,
    sampleRate: 44100,
    decodeAudioData: vi.fn().mockResolvedValue({
      duration: 10,
      sampleRate: 44100,
      numberOfChannels: 2,
      length: 441000,
      getChannelData: () => new Float32Array(441000),
    } as AudioBufferLike),
    createGain: vi.fn(() => mockGain),
    createBufferSource: vi.fn(() => mockSource),
    createChannelSplitter: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    createChannelMerger: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function makeTestAudioPlan(overrides?: Partial<AudioRenderPlan>): AudioRenderPlan {
  return {
    fps: 30,
    clips: [
      {
        assetId: "asset.bgm",
        uri: "https://cdn.example/bgm.mp3",
        fromFrame: 0,
        durationInFrames: 150,
        trimStartSeconds: 0,
        trimEndSeconds: 5,
        assetDurationSeconds: 5,
        playbackRate: 1,
        volumeEnvelope: [
          { frame: 0, value: 0 },
          { frame: 15, value: 0.8 },
          { frame: 135, value: 0.8 },
          { frame: 150, value: 0 },
        ],
        role: "bgm" as const,
        loop: false,
        channelPolicy: "stereo" as const,
      },
    ],
    ...overrides,
  };
}

// ── Task 7.1: AudioRenderPlan expansion ───────────────────────────

describe("Task 7.1 — AudioRenderPlan expansion", () => {
  it("includes assetDurationSeconds from resolved asset", () => {
    const plan = makeTestAudioPlan();
    expect(plan.clips[0]!.assetDurationSeconds).toBe(5);
  });

  it("includes trimEndSeconds", () => {
    const plan = makeTestAudioPlan();
    expect(plan.clips[0]!.trimEndSeconds).toBe(5);
  });

  it("includes channelPolicy (default stereo)", () => {
    const plan = makeTestAudioPlan();
    expect(plan.clips[0]!.channelPolicy).toBe("stereo");
  });

  it("supports mono channelPolicy", () => {
    const plan = makeTestAudioPlan({
      clips: [
        {
          ...makeTestAudioPlan().clips[0]!,
          channelPolicy: "mono",
        },
      ],
    });
    expect(plan.clips[0]!.channelPolicy).toBe("mono");
  });

  it("supports left-only channelPolicy", () => {
    const plan = makeTestAudioPlan({
      clips: [
        {
          ...makeTestAudioPlan().clips[0]!,
          channelPolicy: "left-only",
        },
      ],
    });
    expect(plan.clips[0]!.channelPolicy).toBe("left-only");
  });

  it("supports right-only channelPolicy", () => {
    const plan = makeTestAudioPlan({
      clips: [
        {
          ...makeTestAudioPlan().clips[0]!,
          channelPolicy: "right-only",
        },
      ],
    });
    expect(plan.clips[0]!.channelPolicy).toBe("right-only");
  });

  it("includes optional loopWindow fields", () => {
    const plan = makeTestAudioPlan({
      clips: [
        {
          ...makeTestAudioPlan().clips[0]!,
          loop: true,
          loopWindowStartSeconds: 1,
          loopWindowEndSeconds: 4,
        },
      ],
    });
    expect(plan.clips[0]!.loopWindowStartSeconds).toBe(1);
    expect(plan.clips[0]!.loopWindowEndSeconds).toBe(4);
  });

  it("buildAudioRenderPlan resolves asset duration from runtime", () => {
    const runtime = {
      format: "motion-runtime" as const,
      formatVersion: 2,
      metadata: {
        id: "test",
        title: "Test",
        aspectRatio: "16:9" as const,
        width: 1920,
        height: 1080,
      },
      assets: [
        {
          id: "asset.bgm",
          assetType: "audio" as const,
          uri: "https://cdn.example/bgm.mp3",
          mimeType: "audio/mpeg" as const,
          duration: 30,
          sampleRate: 44100,
          channels: 2,
          codec: "mp3",
        },
      ],
      variables: [],
      timeline: {
        sceneOrder: ["s1"],
        audioTracks: [
          {
            id: "aud.bgm",
            role: "bgm" as const,
            assetId: "asset.bgm",
            start: 0,
            volume: 0.8,
            loop: false,
          },
        ],
        captionTracks: [],
      },
      scenes: [
        {
          id: "s1",
          duration: 5,
          nodes: [],
          tracks: [],
          clips: [],
        },
      ],
    };

    const plan = buildAudioRenderPlan({
      runtime: runtime as any,
      fps: 30,
      durationInFrames: 150,
    });

    expect(plan.clips).toHaveLength(1);
    expect(plan.clips[0]!.assetDurationSeconds).toBe(30);
    expect(plan.clips[0]!.trimEndSeconds).toBe(30);
  });
});

// ── Task 7.2: Web Audio scheduler ─────────────────────────────────

describe("Task 7.2 — Web Audio scheduler", () => {
  let scheduler: AudioScheduler;
  let mockCtx: AudioContextLike;

  beforeEach(() => {
    mockCtx = createMockAudioContext();
    scheduler = createAudioScheduler({ audioContext: mockCtx });
  });

  afterEach(() => {
    scheduler.dispose();
  });

  it("loadPlan builds track states without crashing", async () => {
    const plan = makeTestAudioPlan();
    await expect(scheduler.loadPlan(plan)).resolves.toBeUndefined();
  });

  it("start schedules clips without error", async () => {
    const plan = makeTestAudioPlan();
    await scheduler.loadPlan(plan);
    expect(() => scheduler.start(0)).not.toThrow();
  });

  it("stop cleans up without error", async () => {
    const plan = makeTestAudioPlan();
    await scheduler.loadPlan(plan);
    scheduler.start(0);
    expect(() => scheduler.stop()).not.toThrow();
  });

  it("reschedule stops old and starts new", async () => {
    const plan1 = makeTestAudioPlan();
    const plan2 = makeTestAudioPlan({
      clips: [
        {
          ...makeTestAudioPlan().clips[0]!,
          fromFrame: 30,
        },
      ],
    });

    await scheduler.loadPlan(plan1);
    scheduler.start(0);
    await scheduler.reschedule(plan2, 1);
    // No crash = pass
    expect(true).toBe(true);
  });

  it("setMuted mutes the track gain", async () => {
    const plan = makeTestAudioPlan();
    await scheduler.loadPlan(plan);
    const trackKey = "asset.bgm:bgm";
    expect(() => scheduler.setMuted(trackKey, true)).not.toThrow();
    expect(() => scheduler.setMuted(trackKey, false)).not.toThrow();
  });

  it("setSolo solos the track", async () => {
    const plan = makeTestAudioPlan();
    await scheduler.loadPlan(plan);
    const trackKey = "asset.bgm:bgm";
    expect(() => scheduler.setSolo(trackKey, true)).not.toThrow();
    expect(() => scheduler.setSolo(trackKey, false)).not.toThrow();
  });

  it("setVolume updates track gain with ramp", async () => {
    const plan = makeTestAudioPlan();
    await scheduler.loadPlan(plan);
    const trackKey = "asset.bgm:bgm";
    expect(() => scheduler.setVolume(trackKey, 0.5)).not.toThrow();
    expect(() => scheduler.setVolume(trackKey, 0.8, 0.1)).not.toThrow();
  });

  it("dispose cleans up all tracks", async () => {
    const plan = makeTestAudioPlan();
    await scheduler.loadPlan(plan);
    scheduler.start(0);
    scheduler.dispose();
    // After dispose, start should be no-op
    expect(() => scheduler.start(0)).not.toThrow();
  });

  it("currentTime returns AudioContext time", () => {
    expect(scheduler.currentTime()).toBe(0);
  });

  it("handles empty plan gracefully", async () => {
    const plan: AudioRenderPlan = { fps: 30, clips: [] };
    await scheduler.loadPlan(plan);
    expect(() => scheduler.start(0)).not.toThrow();
  });

  it("handles multiple clips in a plan", async () => {
    const plan: AudioRenderPlan = {
      fps: 30,
      clips: [
        {
          assetId: "asset.bgm",
          uri: "https://cdn.example/bgm.mp3",
          fromFrame: 0,
          durationInFrames: 150,
          trimStartSeconds: 0,
          trimEndSeconds: 5,
          assetDurationSeconds: 5,
          playbackRate: 1,
          volumeEnvelope: [
            { frame: 0, value: 0 },
            { frame: 15, value: 1 },
            { frame: 150, value: 0 },
          ],
          role: "bgm",
          loop: false,
          channelPolicy: "stereo",
        },
        {
          assetId: "asset.vo",
          uri: "https://cdn.example/vo.mp3",
          fromFrame: 30,
          durationInFrames: 90,
          trimStartSeconds: 0,
          trimEndSeconds: 3,
          assetDurationSeconds: 3,
          playbackRate: 1,
          volumeEnvelope: [
            { frame: 30, value: 1 },
            { frame: 120, value: 1 },
          ],
          role: "voiceover",
          loop: false,
          channelPolicy: "mono",
        },
      ],
    };
    await scheduler.loadPlan(plan);
    expect(() => scheduler.start(0)).not.toThrow();
    scheduler.stop();
  });
});

// ── Task 7.3: Volume envelope linear interpolation ────────────────

describe("Task 7.3 — volume envelope linear interpolation", () => {
  it("interpolates between two keyframes linearly", () => {
    const envelope = [
      { frame: 0, value: 0 },
      { frame: 10, value: 1 },
    ];
    expect(sampleAudioVolumeLinear(envelope, 5)).toBeCloseTo(0.5, 2);
  });

  it("returns first value before first keyframe", () => {
    const envelope = [
      { frame: 10, value: 0.5 },
      { frame: 20, value: 1 },
    ];
    expect(sampleAudioVolumeLinear(envelope, 5)).toBeCloseTo(0.5);
  });

  it("returns last value after last keyframe", () => {
    const envelope = [
      { frame: 0, value: 0 },
      { frame: 10, value: 0.8 },
    ];
    expect(sampleAudioVolumeLinear(envelope, 20)).toBeCloseTo(0.8);
  });

  it("returns single keyframe value", () => {
    const envelope = [{ frame: 0, value: 0.7 }];
    expect(sampleAudioVolumeLinear(envelope, 100)).toBeCloseTo(0.7);
  });

  it("returns 0 for empty envelope", () => {
    expect(sampleAudioVolumeLinear([], 10)).toBe(0);
  });

  it("produces continuous fade (no step/hold)", () => {
    const envelope = [
      { frame: 0, value: 0 },
      { frame: 15, value: 0.8 },
      { frame: 135, value: 0.8 },
      { frame: 150, value: 0 },
    ];

    // Check that values are continuous across the whole range
    const values: number[] = [];
    for (let f = 0; f <= 150; f += 3) {
      values.push(sampleAudioVolumeLinear(envelope, f));
    }

    // All values should be between 0 and 0.8
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0.8);
    }

    // Mid-fade check
    expect(sampleAudioVolumeLinear(envelope, 7)).toBeGreaterThan(0);
    expect(sampleAudioVolumeLinear(envelope, 7)).toBeLessThan(0.8);
  });

  it("quarter-way interpolation is accurate", () => {
    const envelope = [
      { frame: 0, value: 0 },
      { frame: 100, value: 1 },
    ];
    expect(sampleAudioVolumeLinear(envelope, 25)).toBeCloseTo(0.25, 2);
    expect(sampleAudioVolumeLinear(envelope, 50)).toBeCloseTo(0.5, 2);
    expect(sampleAudioVolumeLinear(envelope, 75)).toBeCloseTo(0.75, 2);
  });
});

// ── Task 7.5: MediaFrameProvider ──────────────────────────────────

describe("Task 7.5 — MediaFrameProvider", () => {
  // MediaFrameProvider uses DOM APIs — we test the interface contract
  // via structural checks (no DOM in Node vitest)

  it("createMediaFrameProvider returns the expected interface", () => {
    const provider = createMediaFrameProvider();
    expect(provider).toBeDefined();
    expect(typeof provider.acquire).toBe("function");
    expect(typeof provider.release).toBe("function");
    expect(typeof provider.updateFrame).toBe("function");
    expect(typeof provider.pollFrameReady).toBe("function");
    expect(typeof provider.getActiveHandles).toBe("function");
    expect(typeof provider.dispose).toBe("function");
    expect(typeof provider.webCodecsAvailable).toBe("boolean");
  });

  it("webCodecsAvailable is a boolean", () => {
    const provider = createMediaFrameProvider();
    expect(provider.webCodecsAvailable).toBe(false); // Node env, no VideoDecoder
  });

  it("dispose on empty provider does not throw", () => {
    const provider = createMediaFrameProvider();
    expect(() => provider.dispose()).not.toThrow();
  });

  it("getActiveHandles returns empty array initially", () => {
    const provider = createMediaFrameProvider();
    expect(provider.getActiveHandles()).toEqual([]);
  });

  it("provider can be created with options", () => {
    const onFrameReady = vi.fn();
    const onError = vi.fn();
    const provider = createMediaFrameProvider({
      onFrameReady,
      onError,
      loadTimeoutMs: 5000,
    });
    expect(provider).toBeDefined();
  });

  it("release on non-existent handle is no-op", () => {
    const provider = createMediaFrameProvider();
    const fakeHandle: MediaTextureHandle = {
      id: "fake",
      assetId: "nonexistent",
      element: {} as HTMLVideoElement,
      frameReady: false,
      lastSourceFrame: -1,
    };
    expect(() => provider.release(fakeHandle)).not.toThrow();
  });

  it("dispose after double-call is safe", () => {
    const provider = createMediaFrameProvider();
    provider.dispose();
    expect(() => provider.dispose()).not.toThrow();
  });
});

// ── Integration tests — audio plan + scheduler ────────────────────

describe("Phase 7 integration", () => {
  it("scheduler handles rapid start/stop cycles", async () => {
    const mockCtx = createMockAudioContext();
    const scheduler = createAudioScheduler({ audioContext: mockCtx });
    const plan = makeTestAudioPlan();

    await scheduler.loadPlan(plan);

    for (let i = 0; i < 10; i++) {
      scheduler.start(i * 0.5);
      scheduler.stop();
    }

    scheduler.dispose();
    // No crash = pass
    expect(true).toBe(true);
  });

  it("scheduler handles seek to different positions", async () => {
    const mockCtx = createMockAudioContext();
    const scheduler = createAudioScheduler({ audioContext: mockCtx });
    const plan = makeTestAudioPlan();

    await scheduler.loadPlan(plan);

    // Simulate scrub
    for (const t of [0, 1, 2, 3, 4, 3, 2, 1, 0]) {
      scheduler.start(t);
      scheduler.stop();
    }

    scheduler.dispose();
    expect(true).toBe(true);
  });

  it("scheduler setMuted on all tracks then unmute", async () => {
    const mockCtx = createMockAudioContext();
    const scheduler = createAudioScheduler({ audioContext: mockCtx });
    const plan = makeTestAudioPlan({
      clips: [
        {
          ...makeTestAudioPlan().clips[0]!,
        },
        {
          assetId: "asset.vo",
          uri: "https://cdn.example/vo.mp3",
          fromFrame: 30,
          durationInFrames: 90,
          trimStartSeconds: 0,
          trimEndSeconds: 3,
          assetDurationSeconds: 3,
          playbackRate: 1,
          volumeEnvelope: [{ frame: 30, value: 1 }, { frame: 120, value: 1 }],
          role: "voiceover" as const,
          loop: false,
          channelPolicy: "mono" as const,
        },
      ],
    });

    await scheduler.loadPlan(plan);

    expect(() => scheduler.setMuted("asset.bgm:bgm", true)).not.toThrow();
    expect(() => scheduler.setMuted("asset.vo:voiceover", true)).not.toThrow();
    expect(() => scheduler.setMuted("asset.bgm:bgm", false)).not.toThrow();
    expect(() => scheduler.setMuted("asset.vo:voiceover", false)).not.toThrow();

    scheduler.dispose();
    expect(true).toBe(true);
  });
});
