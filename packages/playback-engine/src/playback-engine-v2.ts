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

export type PlaybackV2Consumer = {
  paintCompositionFrame?(frame: RuntimeFrameV2): void;
  consumeAudioMixPlan?(plan: RuntimeAudioMixPlanV2, context: PlaybackAudioPlanContextV2): void;
};

export type PlaybackAudioPlanContextV2 = {
  /** The shared composition time represented by the visual frame. */
  time: number;
  /** True when the range includes seek restart preroll. */
  preroll: boolean;
};

export type PlaybackV2Scheduler = {
  now(): number;
  request(callback: () => void): unknown;
  cancel(handle: unknown): void;
};

export type PlaybackEngineV2Options = {
  scheduler?: PlaybackV2Scheduler;
  audio?: PlaybackAudioSchedulingPolicyV2;
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

export type PlaybackEngineV2 = {
  load(runtime: RuntimeProjectV2): void;
  play(): void;
  pause(): void;
  seek(time: number): void;
  renderAt(time: number): PlaybackV2Output | null;
  renderFrameAt(time: number): RuntimeFrameV2 | null;
  readonly playing: boolean;
  readonly currentTime: number;
  readonly currentFrame: number;
  readonly duration: number;
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
  const audioBlockDuration = positivePolicyValue(options.audio?.blockDuration, 0.1, "audio block duration");
  const seekPreroll = positivePolicyValue(options.audio?.seekPreroll, 0.05, "audio seek preroll");
  let runtime: RuntimeProjectV2 | null = null;
  let duration = 0;
  let clock = createPlaybackClock({
    fps: 30,
    duration: 0,
    getMonotonicTime: () => scheduler.now() / 1000,
  });
  let scheduleHandle: unknown = null;
  let disposed = false;

  const render = (nextTime: number, preroll = false): PlaybackV2Output | null => {
    if (!runtime) return null;
    const clamped = Math.min(duration, Math.max(0, nextTime));
    const frame = frameIndexAtTime(clamped, runtime.composition.fps);
    const evaluated = evaluateRuntimeProjectV2(runtime, frame, { time: clamped });
    const sampleRate = runtime.audio?.sampleRate ?? 48000;
    const startTime = Math.max(0, clamped - (preroll ? seekPreroll : 0));
    const endTime = Math.max(clamped, Math.min(duration, clamped + audioBlockDuration));
    const startSample = secondsToSamples(startTime, sampleRate);
    const endSample = Math.max(
      startSample + 1,
      secondsToSamples(endTime, sampleRate),
    );
    const audioPlan = evaluateRuntimeAudioMixV2(runtime, { startSample, endSample });
    consumer.paintCompositionFrame?.(evaluated);
    consumer.consumeAudioMixPlan?.(audioPlan, { time: clamped, preroll });
    return { time: clamped, frame: evaluated, audioPlan };
  };

  const cancelScheduledFrame = () => {
    if (scheduleHandle === null) return;
    scheduler.cancel(scheduleHandle);
    scheduleHandle = null;
  };

  const tick = () => {
    scheduleHandle = null;
    if (disposed || !clock.isRunning()) return;
    const nextTime = clock.currentTime();
    render(nextTime);
    if (nextTime >= duration) {
      clock.pause();
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
      runtime = next;
      duration = runtimeDuration(next);
      clock.dispose();
      clock = createPlaybackClock({
        fps: runtime.composition.fps,
        duration,
        getMonotonicTime: () => scheduler.now() / 1000,
      });
    },
    play() {
      if (!runtime || disposed || clock.currentTime() >= duration) return;
      clock.play();
      schedule();
    },
    pause() {
      clock.pause();
      cancelScheduledFrame();
    },
    seek(nextTime) {
      clock.seek(Math.min(duration, Math.max(0, nextTime)));
      if (runtime) render(clock.currentTime(), true);
    },
    renderAt(nextTime) {
      clock.seek(Math.min(duration, Math.max(0, nextTime)));
      return render(clock.currentTime());
    },
    renderFrameAt(nextTime) {
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
    dispose() {
      disposed = true;
      cancelScheduledFrame();
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
