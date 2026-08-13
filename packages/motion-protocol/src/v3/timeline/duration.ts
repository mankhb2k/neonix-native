/**
 * Derive `timeline.duration` V3.
 *
 *   max(
 *     ...visualTracks.flatMap(track => track.clips.map(clip => clip.start + clip.duration)),
 *     ...audioTracks.flatMap(track => track.clips.map(clip => clip.start + clip.duration)),
 *     ...captionTracks.flatMap(track => track.tokens.map(token => token.end)),
 *   )
 */
import type {
  AudioTrackV3,
  CaptionTrackV3,
  ProjectTimelineV3,
  VisualTrackV3,
} from "./schema";

export function roundTimelineValue(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

export function getVisualTimelineEndV3(timeline: {
  visualTracks: ReadonlyArray<Pick<VisualTrackV3, "clips">>;
}): number {
  let end = 0;
  for (const track of timeline.visualTracks) {
    for (const clip of track.clips) {
      end = Math.max(end, clip.start + clip.duration);
    }
  }
  return roundTimelineValue(end);
}

export function getAudioTimelineEndV3(timeline: {
  audioTracks: ReadonlyArray<Pick<AudioTrackV3, "clips">>;
}): number {
  let end = 0;
  for (const track of timeline.audioTracks) {
    for (const clip of track.clips) {
      end = Math.max(end, clip.start + clip.duration);
    }
  }
  return roundTimelineValue(end);
}

export function getCaptionTimelineEndV3(timeline: {
  captionTracks: ReadonlyArray<Pick<CaptionTrackV3, "tokens">>;
}): number {
  let end = 0;
  for (const track of timeline.captionTracks) {
    for (const token of track.tokens) {
      end = Math.max(end, token.end);
    }
  }
  return roundTimelineValue(end);
}

export function deriveTimelineDurationV3(timeline: ProjectTimelineV3): number {
  return roundTimelineValue(
    Math.max(
      getVisualTimelineEndV3(timeline),
      getAudioTimelineEndV3(timeline),
      getCaptionTimelineEndV3(timeline),
    ),
  );
}

export function hasTimelineContentV3(timeline: ProjectTimelineV3): boolean {
  return (
    timeline.visualTracks.some((track) => track.clips.length > 0) ||
    timeline.audioTracks.some((track) => track.clips.length > 0) ||
    timeline.captionTracks.some((track) => track.tokens.length > 0)
  );
}
