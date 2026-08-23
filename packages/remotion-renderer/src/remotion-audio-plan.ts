import {
  evaluateRuntimeAudioMixV2,
  secondsToSamples,
  type RuntimeAudioMixPlanV2,
  type RuntimeProjectV2,
} from "@motionvideo/motion-runtime";

const OUTPUT_SAMPLE_RATE = 48000;

function runtimeAudioDuration(runtime: RuntimeProjectV2): number {
  return runtime.audio?.tracks.reduce(
    (duration, track) => track.clips.reduce(
      (trackDuration, clip) => Math.max(
        trackDuration,
        clip.timing.start + clip.timing.duration,
      ),
      duration,
    ),
    runtime.composition.duration ?? 0,
  ) ?? runtime.composition.duration ?? 0;
}

/** Build the one export mix window from Runtime Audio IR. */
export function buildRemotionAudioPlanV2(
  runtime: RuntimeProjectV2,
): RuntimeAudioMixPlanV2 | null {
  if (!runtime.audio || runtime.audio.tracks.length === 0) return null;
  const endSample = Math.max(
    1,
    secondsToSamples(runtimeAudioDuration(runtime), OUTPUT_SAMPLE_RATE),
  );
  const plan = evaluateRuntimeAudioMixV2(runtime, {
    startSample: 0,
    endSample,
  });
  return plan.inputs.length > 0 ? plan : null;
}

export function runtimeAudioDurationV2(runtime: RuntimeProjectV2): number {
  return runtimeAudioDuration(runtime);
}
