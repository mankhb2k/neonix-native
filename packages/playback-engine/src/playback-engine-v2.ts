import {
  evaluateRuntimeProjectV2,
  frameIndexAtTime,
  type RuntimeFrameV2,
  type RuntimeProjectV2,
} from "@motionvideo/motion-runtime";

export type PlaybackV2Consumer = {
  paintCompositionFrame(frame: RuntimeFrameV2): void;
};

export type PlaybackEngineV2 = {
  load(runtime: RuntimeProjectV2): void;
  play(): void;
  pause(): void;
  seek(time: number): void;
  renderFrameAt(time: number): RuntimeFrameV2 | null;
  readonly playing: boolean;
  readonly currentTime: number;
  readonly currentFrame: number;
  readonly duration: number;
};

function runtimeDuration(runtime: RuntimeProjectV2): number {
  return runtime.nodes.reduce(
    (duration, node) => Math.max(duration, node.timing.start + node.timing.duration),
    0,
  );
}

/**
 * Small V2 live-playback boundary. Transport owns time; Runtime V2 owns frame
 * evaluation. Worker buffering remains a separate concern and must consume the
 * serialized RuntimeProjectV2 instead of compiling an authoring project.
 */
export function createPlaybackEngineV2(
  consumer: PlaybackV2Consumer,
): PlaybackEngineV2 {
  let runtime: RuntimeProjectV2 | null = null;
  let duration = 0;
  let time = 0;
  let playing = false;

  const render = (nextTime: number): RuntimeFrameV2 | null => {
    if (!runtime) return null;
    const clamped = Math.min(duration, Math.max(0, nextTime));
    const frame = frameIndexAtTime(clamped, runtime.composition.fps);
    const evaluated = evaluateRuntimeProjectV2(runtime, frame, { time: clamped });
    consumer.paintCompositionFrame(evaluated);
    time = clamped;
    return evaluated;
  };

  return {
    load(next) {
      runtime = next;
      duration = runtimeDuration(next);
      time = 0;
      playing = false;
    },
    play() {
      if (runtime) playing = true;
    },
    pause() {
      playing = false;
    },
    seek(nextTime) {
      time = Math.min(duration, Math.max(0, nextTime));
      if (runtime) render(time);
    },
    renderFrameAt(nextTime) {
      return render(nextTime);
    },
    get playing() {
      return playing;
    },
    get currentTime() {
      return time;
    },
    get currentFrame() {
      return runtime ? frameIndexAtTime(time, runtime.composition.fps) : 0;
    },
    get duration() {
      return duration;
    },
  };
}
