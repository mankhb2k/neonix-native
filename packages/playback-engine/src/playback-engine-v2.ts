import {
  evaluateRuntimeAudioMixV2,
  evaluateRuntimeProjectV2,
  frameIndexAtTime,
  secondsToSamples,
  type RuntimeAudioMixPlanV2,
  type RuntimeFrameV2,
  type RuntimeProjectV2,
} from "@motionvideo/motion-runtime";
import { createPlaybackClock } from "./playback-clock";
import type {
  PlaybackMediaCommandV2,
  PlaybackMediaControllerV2,
} from "./media-controller-v2";
import { createBoundedHistory } from "./bounded-history";

export type PlaybackV2Consumer = {
  paintCompositionFrame?(frame: RuntimeFrameV2, context: PlaybackFrameContextV2): void;
  /**
   * Requests best-effort decoding for the audio immediately around a paused
   * preview position. This must not create audible sources or advance the
   * transport.
   */
  prefetchAudioMixPlan?(plan: RuntimeAudioMixPlanV2): void;
  /** Optional blocking pre-roll hook used before the transport clock starts. */
  prepareAudioMixPlan?(plan: RuntimeAudioMixPlanV2): Promise<boolean>;
  consumeAudioMixPlan?(plan: RuntimeAudioMixPlanV2, context: PlaybackAudioPlanContextV2): void;
  pauseAudio?(): void;
  onSnapshot?(snapshot: PlaybackV2Snapshot): void;
};

export type PlaybackFrameContextV2 = {
  time: number;
  playing: boolean;
  generation: number;
};

export type PlaybackAudioPlanContextV2 = {
  /** The shared composition time represented by the visual frame. */
  time: number;
  /** True when the range includes seek restart preroll. */
  preroll: boolean;
  /** Monotonic engine generation for stale async consumers. */
  generation: number;
};

export type PlaybackV2Scheduler = {
  now(): number;
  request(callback: () => void): unknown;
  cancel(handle: unknown): void;
};

export type PlaybackEngineV2Options = {
  scheduler?: PlaybackV2Scheduler;
  audio?: PlaybackAudioSchedulingPolicyV2;
  media?: PlaybackMediaControllerV2;
  /** Collect detailed hot-path timings. Intended for diagnostics, not production. */
  collectPerformanceMetrics?: boolean;
  /** Number of performance samples retained for dev/test inspection. */
  performanceSampleCapacity?: number;
  /** Loop the whole project transport after its final layer ends. */
  timelineLoop?: boolean;
};

export type PlaybackAudioSchedulingPolicyV2 = {
  /** Number of composition seconds exposed to the next audio scheduling pass. */
  blockDuration?: number;
  /** Seconds scheduled before a seek position so an adapter can restart cleanly. */
  seekPreroll?: number;
};

export type PlaybackV2Output = {
  time: number;
  frame: RuntimeFrameV2;
  audioPlan: RuntimeAudioMixPlanV2;
};

export type PlaybackV2Snapshot = {
  time: number;
  frame: RuntimeFrameV2 | null;
  playing: boolean;
  audioPlan: RuntimeAudioMixPlanV2 | null;
  mediaCommands: readonly PlaybackMediaCommandV2[];
  /** Monotonic transport generation; increments whenever a schedule is reset. */
  generation: number;
  /** Visual media currently addressed by the frame command set. */
  activeVisualMediaIds: readonly string[];
  /** Audio inputs represented by the current mix plan (including muted inputs). */
  activeAudioInputIds: readonly string[];
  /** Lightweight timings collected on the actual realtime playback path. */
  performance: PlaybackPerformanceV2;
};

export type PlaybackPerformanceV2 = {
  /** Time between the two latest realtime scheduler callbacks. */
  tickIntervalMs: number | null;
  /** Runtime visual evaluation cost for the latest rendered frame. */
  evaluateMs: number;
  /** Runtime audio-plan evaluation cost for the latest rendered frame. */
  audioPlanMs: number;
  /** Time spent invoking visual/audio consumers for the latest frame. */
  consumerMs: number;
  /** Synchronous media-controller invocation cost for the latest frame. */
  mediaSyncMs: number;
  /** Total synchronous render cost for the latest frame. */
  renderMs: number;
  /** Scheduler intervals that exceeded 1.5 composition-frame durations. */
  longFrameCount: number;
  /** Frames estimated to have been skipped from scheduler interval gaps. */
  estimatedDroppedFrames: number;
  /** Delay from play() to the first realtime scheduler callback. */
  playToFirstFrameMs: number | null;
};

export type PlaybackPerformanceSampleV2 = PlaybackPerformanceV2 & {
  /** Scheduler timestamp at which this sample was recorded. */
  atMs: number;
  /** Composition time represented by the sample. */
  time: number;
  /** Engine generation represented by the sample. */
  generation: number;
};

export type PlaybackEngineV2 = {
  load(runtime: RuntimeProjectV2): void;
  play(): void;
  /** Prepare the current audio window without starting visual transport. */
  prepareAudioAt(time?: number): Promise<boolean>;
  pause(): void;
  seek(time: number): void;
  /** Seek the visual frame without scheduling or starting audio playback. */
  previewFrameAt(time: number): RuntimeFrameV2 | null;
  renderAt(time: number): PlaybackV2Output | null;
  renderFrameAt(time: number): RuntimeFrameV2 | null;
  readonly playing: boolean;
  readonly currentTime: number;
  readonly currentFrame: number;
  readonly duration: number;
  /** Bounded realtime samples; empty unless performance metrics are enabled. */
  getPerformanceSamples(): readonly PlaybackPerformanceSampleV2[];
  subscribe(listener: (snapshot: PlaybackV2Snapshot) => void): () => void;
  dispose(): void;
};

function runtimeDuration(runtime: RuntimeProjectV2): number {
  const visualDuration = runtime.nodes.reduce(
    (duration, node) => Math.max(duration, node.timing.start + node.timing.duration),
    0,
  );
  const audioDuration = runtime.audio?.tracks.reduce(
    (duration, track) => track.clips.reduce(
      (trackDuration, clip) => Math.max(
        trackDuration,
        clip.timing.start + clip.timing.duration,
      ),
      duration,
    ),
    0,
  ) ?? 0;
  return Math.max(runtime.composition.duration ?? 0, visualDuration, audioDuration);
}

function positivePolicyValue(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Playback ${name} must be finite and positive`);
  }
  return value;
}

/**
 * Small V2 live-playback boundary. Transport owns time; Runtime V2 owns frame
 * evaluation. Worker buffering remains a separate concern and must consume the
 * serialized RuntimeProjectV2 instead of compiling an authoring project.
 */
export function createPlaybackEngineV2(
  consumer: PlaybackV2Consumer,
  options: PlaybackEngineV2Options = {},
): PlaybackEngineV2 {
  const scheduler = options.scheduler ?? defaultScheduler();
  // Keep enough decoded audio scheduled to survive a temporarily busy main
  // thread (for example a costly WebGL paint or a React devtools pause).
  // This is a look-ahead window, not an additional decode/cache budget.
  const audioBlockDuration = positivePolicyValue(options.audio?.blockDuration, 0.25, "audio block duration");
  const seekPreroll = positivePolicyValue(options.audio?.seekPreroll, 0.05, "audio seek preroll");
  const timelineLoop = options.timelineLoop ?? false;
  const collectPerformanceMetrics = options.collectPerformanceMetrics ?? false;
  let runtime: RuntimeProjectV2 | null = null;
  let duration = 0;
  let clock = createPlaybackClock({
    fps: 30,
    duration: 0,
    getMonotonicTime: () => scheduler.now() / 1000,
  });
  let scheduleHandle: unknown = null;
  let disposed = false;
  let lastOutput: PlaybackV2Output | null = null;
  let generation = 0;
  let lastTickAt: number | null = null;
  let playRequestedAt: number | null = null;
  let performanceSnapshot: PlaybackPerformanceV2 = {
    tickIntervalMs: null,
    evaluateMs: 0,
    audioPlanMs: 0,
    consumerMs: 0,
    mediaSyncMs: 0,
    renderMs: 0,
    longFrameCount: 0,
    estimatedDroppedFrames: 0,
    playToFirstFrameMs: null,
  };
  const performanceSampleCapacity = Math.max(
    0,
    collectPerformanceMetrics
      ? Math.floor(options.performanceSampleCapacity ?? 120)
      : 0,
  );
  const performanceSamples = createBoundedHistory<PlaybackPerformanceSampleV2>(
    performanceSampleCapacity,
  );
  const listeners = new Set<(snapshot: PlaybackV2Snapshot) => void>();

  const publish = (
    output: PlaybackV2Output | null,
    playing: boolean,
    timeOverride?: number,
  ): void => {
    const snapshot: PlaybackV2Snapshot = {
      time: timeOverride ?? output?.time ?? clock.currentTime(),
      frame: output?.frame ?? null,
      playing,
      audioPlan: output?.audioPlan ?? null,
      mediaCommands: output?.frame?.commands.filter(
        (command): command is PlaybackMediaCommandV2 => command.op === "drawVideo",
      ) ?? [],
      generation,
      activeVisualMediaIds: output?.frame?.commands
        .filter((command): command is PlaybackMediaCommandV2 => command.op === "drawVideo" && command.mediaVisible !== false)
        .map((command) => command.assetId) ?? [],
      activeAudioInputIds: output?.audioPlan?.inputs.map(
        (input) => `${input.trackId}:${input.clipId}`,
      ) ?? [],
      performance: { ...performanceSnapshot },
    };
    consumer.onSnapshot?.(snapshot);
    for (const listener of listeners) listener(snapshot);
  };

  const publishVisual = (frame: RuntimeFrameV2 | null, time: number): void => {
    const mediaCommands = frame?.commands.filter(
      (command): command is PlaybackMediaCommandV2 => command.op === "drawVideo",
    ) ?? [];
    const snapshot: PlaybackV2Snapshot = {
      time,
      frame,
      playing: false,
      audioPlan: null,
      mediaCommands,
      generation,
      activeVisualMediaIds: mediaCommands
        .filter((command) => command.mediaVisible !== false)
        .map((command) => command.assetId),
      activeAudioInputIds: [],
      performance: { ...performanceSnapshot },
    };
    consumer.onSnapshot?.(snapshot);
    for (const listener of listeners) listener(snapshot);
  };

  const render = (nextTime: number, preroll = false): PlaybackV2Output | null => {
    if (!runtime) return null;
    const renderStartedAt = collectPerformanceMetrics ? scheduler.now() : 0;
    const clamped = Math.min(duration, Math.max(0, nextTime));
    const frame = frameIndexAtTime(clamped, runtime.composition.fps);
    const evaluateStartedAt = collectPerformanceMetrics ? scheduler.now() : 0;
    const evaluated = evaluateRuntimeProjectV2(runtime, frame, { time: clamped });
    const evaluateEndedAt = collectPerformanceMetrics ? scheduler.now() : 0;
    const sampleRate = runtime.audio?.sampleRate ?? 48000;
    const startTime = Math.max(0, clamped - (preroll ? seekPreroll : 0));
    const endTime = Math.max(clamped, Math.min(duration, clamped + audioBlockDuration));
    const startSample = secondsToSamples(startTime, sampleRate);
    const endSample = Math.max(
      startSample + 1,
      secondsToSamples(endTime, sampleRate),
    );
    const audioPlanStartedAt = collectPerformanceMetrics ? scheduler.now() : 0;
    const audioPlan = evaluateRuntimeAudioMixV2(runtime, { startSample, endSample });
    const audioPlanEndedAt = collectPerformanceMetrics ? scheduler.now() : 0;
    const consumerStartedAt = collectPerformanceMetrics ? scheduler.now() : 0;
    consumer.consumeAudioMixPlan?.(audioPlan, { time: clamped, preroll, generation });
    const audioConsumerEndedAt = collectPerformanceMetrics ? scheduler.now() : 0;
    const output = { time: clamped, frame: evaluated, audioPlan };
    lastOutput = output;
    const mediaSyncStartedAt = collectPerformanceMetrics ? scheduler.now() : 0;
    options.media?.sync(
      output.frame.commands.filter(
        (command): command is PlaybackMediaCommandV2 => command.op === "drawVideo",
      ),
      { time: clamped, playing: clock.isRunning(), generation },
    );
    const mediaSyncEndedAt = collectPerformanceMetrics ? scheduler.now() : 0;
    consumer.paintCompositionFrame?.(evaluated, {
      time: clamped,
      playing: clock.isRunning(),
      generation,
    });
    const consumerEndedAt = collectPerformanceMetrics ? scheduler.now() : 0;
    const renderEndedAt = collectPerformanceMetrics ? scheduler.now() : 0;
    if (collectPerformanceMetrics) {
      performanceSnapshot = {
        ...performanceSnapshot,
        evaluateMs: Math.max(0, evaluateEndedAt - evaluateStartedAt),
        audioPlanMs: Math.max(0, audioPlanEndedAt - audioPlanStartedAt),
        consumerMs: Math.max(
          0,
          (audioConsumerEndedAt - consumerStartedAt)
            + (consumerEndedAt - mediaSyncEndedAt),
        ),
        mediaSyncMs: Math.max(0, mediaSyncEndedAt - mediaSyncStartedAt),
        renderMs: Math.max(0, renderEndedAt - renderStartedAt),
      };
      performanceSamples.push({
        ...performanceSnapshot,
        atMs: renderEndedAt,
        time: clamped,
        generation,
      });
    }
    publish(output, clock.isRunning());
    return output;
  };

  const prefetchAudioAt = (time: number): void => {
    if (!runtime || !consumer.prefetchAudioMixPlan) return;
    const clamped = Math.min(duration, Math.max(0, time));
    const sampleRate = runtime.audio?.sampleRate ?? 48000;
    const startSample = secondsToSamples(clamped, sampleRate);
    const endSample = Math.max(
      startSample + 1,
      secondsToSamples(Math.min(duration, clamped + audioBlockDuration), sampleRate),
    );
    consumer.prefetchAudioMixPlan(evaluateRuntimeAudioMixV2(runtime, { startSample, endSample }));
  };

  const prepareAudioAt = async (time = clock.currentTime()): Promise<boolean> => {
    if (!runtime || disposed) return false;
    const clamped = Math.min(duration, Math.max(0, time));
    const sampleRate = runtime.audio?.sampleRate ?? 48000;
    const startSample = secondsToSamples(Math.max(0, clamped - seekPreroll), sampleRate);
    const endSample = Math.max(
      startSample + 1,
      secondsToSamples(Math.min(duration, clamped + audioBlockDuration), sampleRate),
    );
    const plan = evaluateRuntimeAudioMixV2(runtime, { startSample, endSample });
    if (!consumer.prepareAudioMixPlan) {
      consumer.prefetchAudioMixPlan?.(plan);
      return true;
    }
    return consumer.prepareAudioMixPlan(plan);
  };

  const cancelScheduledFrame = () => {
    if (scheduleHandle === null) return;
    scheduler.cancel(scheduleHandle);
    scheduleHandle = null;
  };

  const tick = () => {
    scheduleHandle = null;
    if (disposed || !clock.isRunning()) return;
    const tickAt = collectPerformanceMetrics ? scheduler.now() : 0;
    const tickIntervalMs = lastTickAt === null ? null : Math.max(0, tickAt - lastTickAt);
    const expectedFrameMs = runtime ? 1000 / Math.max(1, runtime.composition.fps) : 1000 / 30;
    const skipped = tickIntervalMs === null
      ? 0
      : Math.max(0, Math.round(tickIntervalMs / expectedFrameMs) - 1);
    if (collectPerformanceMetrics) {
      performanceSnapshot = {
        ...performanceSnapshot,
        tickIntervalMs,
        longFrameCount: performanceSnapshot.longFrameCount
          + (tickIntervalMs !== null && tickIntervalMs > expectedFrameMs * 1.5 ? 1 : 0),
        estimatedDroppedFrames: performanceSnapshot.estimatedDroppedFrames + skipped,
        playToFirstFrameMs: playRequestedAt === null
          ? performanceSnapshot.playToFirstFrameMs
          : Math.max(0, tickAt - playRequestedAt),
      };
      lastTickAt = tickAt;
      playRequestedAt = null;
    }
    const nextTime = clock.currentTime();
    render(nextTime);
    if (nextTime >= duration) {
      if (timelineLoop && duration > 0) {
        generation += 1;
        clock.seek(0);
        render(0);
        schedule();
        return;
      }
      clock.pause();
      consumer.pauseAudio?.();
      options.media?.pauseAll();
      publish(lastOutput, false);
      return;
    }
    scheduleHandle = scheduler.request(tick);
  };

  const schedule = () => {
    if (scheduleHandle === null && clock.isRunning()) {
      scheduleHandle = scheduler.request(tick);
    }
  };

  return {
    load(next) {
      cancelScheduledFrame();
      generation += 1;
      runtime = next;
      duration = runtimeDuration(next);
      lastOutput = null;
      lastTickAt = null;
      playRequestedAt = null;
      performanceSnapshot = {
        tickIntervalMs: null,
        evaluateMs: 0,
        audioPlanMs: 0,
        consumerMs: 0,
        mediaSyncMs: 0,
        renderMs: 0,
        longFrameCount: 0,
        estimatedDroppedFrames: 0,
        playToFirstFrameMs: null,
      };
      performanceSamples.clear();
      consumer.pauseAudio?.();
      clock.dispose();
      clock = createPlaybackClock({
        fps: runtime.composition.fps,
        duration,
        getMonotonicTime: () => scheduler.now() / 1000,
      });
      options.media?.pauseAll();
      publish(null, false);
    },
    play() {
      if (!runtime || disposed) return;
      if (clock.currentTime() >= duration) {
        if (!timelineLoop || duration <= 0) return;
        generation += 1;
        clock.seek(0);
        lastOutput = null;
      }
      clock.play();
      lastTickAt = null;
      playRequestedAt = collectPerformanceMetrics ? scheduler.now() : null;
      if (lastOutput) publish(lastOutput, true);
      schedule();
    },
    prepareAudioAt,
    pause() {
      generation += 1;
      clock.pause();
      lastTickAt = null;
      playRequestedAt = null;
      cancelScheduledFrame();
      consumer.pauseAudio?.();
      options.media?.pauseAll();
      publish(lastOutput, false, clock.currentTime());
    },
    seek(nextTime) {
      generation += 1;
      clock.seek(Math.min(duration, Math.max(0, nextTime)));
      if (runtime) render(clock.currentTime(), true);
    },
    previewFrameAt(nextTime) {
      generation += 1;
      cancelScheduledFrame();
      clock.pause();
      consumer.pauseAudio?.();
      options.media?.pauseAll();
      const clamped = Math.min(duration, Math.max(0, nextTime));
      clock.seek(clamped);
      if (!runtime) {
        lastOutput = null;
        publishVisual(null, clamped);
        return null;
      }
      const frame = frameIndexAtTime(clamped, runtime.composition.fps);
      const evaluated = evaluateRuntimeProjectV2(runtime, frame, { time: clamped });
      const mediaCommands = evaluated.commands.filter(
        (command): command is PlaybackMediaCommandV2 => command.op === "drawVideo",
      );
      prefetchAudioAt(clamped);
      consumer.paintCompositionFrame?.(evaluated, {
        time: clamped,
        playing: false,
        generation,
      });
      options.media?.sync(mediaCommands, { time: clamped, playing: false, generation });
      lastOutput = null;
      publishVisual(evaluated, clamped);
      return evaluated;
    },
    renderAt(nextTime) {
      generation += 1;
      clock.seek(Math.min(duration, Math.max(0, nextTime)));
      return render(clock.currentTime());
    },
    renderFrameAt(nextTime) {
      generation += 1;
      clock.seek(Math.min(duration, Math.max(0, nextTime)));
      return render(clock.currentTime())?.frame ?? null;
    },
    get playing() {
      return clock.isRunning();
    },
    get currentTime() {
      return clock.currentTime();
    },
    get currentFrame() {
      return runtime ? frameIndexAtTime(clock.currentTime(), runtime.composition.fps) : 0;
    },
    get duration() {
      return duration;
    },
    getPerformanceSamples() {
      return performanceSamples.toArray();
    },
    subscribe(listener) {
      listeners.add(listener);
      if (lastOutput) publish(lastOutput, clock.isRunning());
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      cancelScheduledFrame();
      options.media?.pauseAll();
      options.media?.dispose();
      listeners.clear();
      clock.dispose();
      runtime = null;
    },
  };
}

function defaultScheduler(): PlaybackV2Scheduler {
  const scope = globalThis as typeof globalThis & {
    requestAnimationFrame?: (callback: () => void) => number;
    cancelAnimationFrame?: (handle: number) => void;
  };
  if (scope.requestAnimationFrame && scope.cancelAnimationFrame) {
    return {
      now: () => performance.now(),
      request: (callback) => scope.requestAnimationFrame!(callback),
      cancel: (handle) => scope.cancelAnimationFrame!(handle as number),
    };
  }
  return {
    now: () => Date.now(),
    request: (callback) => setTimeout(callback, 16),
    cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
}
