import {
  resolveAudioWindow,
  secondsToSamples,
  type RuntimeAudioMixPlanV3,
  type RuntimeProjectV3,
} from "@motionvideo/motion-runtime";

const OUTPUT_SAMPLE_RATE = 48000;

function computeRuntimeAudioDuration(runtime: RuntimeProjectV3): number {
  return runtime.audioTimeline.tracks.reduce(
    (duration, track) => track.clips.reduce(
      (trackDuration, clip) => Math.max(
        trackDuration,
        (clip.timelineStartSample + clip.timelineDurationSamples) / runtime.audioTimeline.sampleRate,
      ),
      duration,
    ),
    runtime.visual.composition.duration ?? 0,
  );
}

/** Build the one offline export mix window from the canonical Runtime V3 IR. */
export function buildRemotionAudioPlan(
  runtime: RuntimeProjectV3,
): RuntimeAudioMixPlanV3 | null {
  if (runtime.audioTimeline.tracks.length === 0) return null;
  const endSample = Math.max(
    1,
    secondsToSamples(computeRuntimeAudioDuration(runtime), OUTPUT_SAMPLE_RATE),
  );
  const plan = resolveAudioWindow(runtime, {
    startSample: 0,
    frameCount: endSample,
  });
  return plan.inputs.length > 0 ? plan : null;
}

export function runtimeAudioDuration(runtime: RuntimeProjectV3): number {
  return computeRuntimeAudioDuration(runtime);
}
