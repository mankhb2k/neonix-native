type RuntimeDurationSource = {
  visual: {
    composition: { duration?: number };
    nodes: ReadonlyArray<{ timing: { start: number; duration: number } }>;
  };
  videoTimeline: {
    instances: ReadonlyArray<{ timelineStartUs: number; timelineDurationUs: number }>;
  };
  audioTimeline: {
    sampleRate: number;
    tracks: ReadonlyArray<{ clips: ReadonlyArray<{ timelineStartSample: number; timelineDurationSamples: number }> }>;
  };
};

/**
 * Derives the inclusive runtime timeline extent from every runtime domain.
 * The compiler uses this once to populate RuntimeProjectV3.durationUs;
 * playback consumers must read that canonical value instead of recomputing it.
 */
export function deriveRuntimeProjectDurationUs(runtime: RuntimeDurationSource): number {
  const visualDurationUs = Math.max(
    0,
    (runtime.visual.composition.duration ?? 0) * 1_000_000,
    ...runtime.visual.nodes.map((node) => (node.timing.start + node.timing.duration) * 1_000_000),
  );
  const videoDurationUs = Math.max(
    0,
    ...runtime.videoTimeline.instances.map((instance) => instance.timelineStartUs + instance.timelineDurationUs),
  );
  const sampleRate = runtime.audioTimeline.sampleRate;
  const audioDurationUs = sampleRate > 0
    ? Math.max(
        0,
        ...runtime.audioTimeline.tracks.flatMap((track) =>
          track.clips.map((clip) => ((clip.timelineStartSample + clip.timelineDurationSamples) / sampleRate) * 1_000_000),
        ),
      )
    : 0;
  const durationUs = Math.max(visualDurationUs, videoDurationUs, audioDurationUs);
  return Number.isFinite(durationUs) && durationUs >= 0 ? Math.ceil(durationUs) : 0;
}
