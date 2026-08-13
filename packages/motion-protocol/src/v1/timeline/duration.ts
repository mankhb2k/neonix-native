/**
 * Derive `timeline.duration` V1.
 *
 *   max(
 *     ...visualTracks.flatMap(track => track.clips.map(clip => clip.start + clip.duration)),
 *     ...audioTracks.flatMap(track => track.clips.map(clip => clip.start + clip.duration)),
 *     ...captionTracks.flatMap(track => track.tokens.map(token => token.end)),
 *   )
 */
import type {
  AudioTrackV1,
  CaptionTrackV1,
  ProjectTimelineV1,
  VisualTrackV1,
} from "./schema";

export function roundTimelineValue(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

export function getVisualTimelineEndV1(timeline: {
  visualTracks: ReadonlyArray<Pick<VisualTrackV1, "clips">>;
}): number {
  let end = 0;
  for (const track of timeline.visualTracks) {
    for (const clip of track.clips) {
      end = Math.max(end, clip.start + clip.duration);
    }
  }
  return roundTimelineValue(end);
}

export function getAudioTimelineEndV1(timeline: {
  audioTracks: ReadonlyArray<Pick<AudioTrackV1, "clips">>;
}): number {
  let end = 0;
  for (const track of timeline.audioTracks) {
    for (const clip of track.clips) {
      end = Math.max(end, clip.start + clip.duration);
    }
  }
  return roundTimelineValue(end);
}

export function getCaptionTimelineEndV1(timeline: {
  captionTracks: ReadonlyArray<Pick<CaptionTrackV1, "tokens">>;
}): number {
  let end = 0;
  for (const track of timeline.captionTracks) {
    for (const token of track.tokens) {
      end = Math.max(end, token.end);
    }
  }
  return roundTimelineValue(end);
}

export function deriveTimelineDurationV1(timeline: ProjectTimelineV1): number {
  return roundTimelineValue(
    Math.max(
      getVisualTimelineEndV1(timeline),
      getAudioTimelineEndV1(timeline),
      getCaptionTimelineEndV1(timeline),
    ),
  );
}

export function hasTimelineContentV1(timeline: ProjectTimelineV1): boolean {
  return (
    timeline.visualTracks.some((track) => track.clips.length > 0) ||
    timeline.audioTracks.some((track) => track.clips.length > 0) ||
    timeline.captionTracks.some((track) => track.tokens.length > 0)
  );
}
