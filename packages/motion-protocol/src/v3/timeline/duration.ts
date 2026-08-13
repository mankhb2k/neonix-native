/**
 * Derive `timeline.duration` V3.
 *
 * `timeline.duration` là độ dài timeline MP4 cuối (giây). Khi authoring bỏ
 * trống, compiler / canonicalizer derive từ điểm kết thúc nội dung cuối:
 *
 *   max(
 *     ...visualTracks.flatMap(track => track.clips.map(clip => clip.start + clip.duration)),
 *     ...audioTracks.map(track => track.start + track.duration),
 *     ...captionTracks.flatMap(track => track.tokens.map(token => token.end)),
 *   )
 *
 * Không có visual/audio/caption → duration derive = `0`.
 */
import type {
  AudioTrackV3,
  CaptionTrackV3,
  ProjectTimelineV3,
  VisualTrackV3,
} from "./schema";

/**
 * Làm tròn canonical cho duration timeline — làm tròn nanosecond để bỏ nhiễu
 * floating-point khỏi giá trị derive/validate.
 */
export function roundTimelineValue(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

/**
 * Thời điểm kết thúc muộn nhất của mọi visual clip.
 * Visual clip là nội dung timeline; `start + duration` bound độ dài MP4.
 */
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

/**
 * Thời điểm kết thúc muộn nhất của mọi audio track.
 * Audio là nội dung timeline — không được cắt im lặng.
 */
export function getAudioTimelineEndV3(timeline: {
  audioTracks: ReadonlyArray<Pick<AudioTrackV3, "start" | "duration">>;
}): number {
  let end = 0;
  for (const track of timeline.audioTracks) {
    end = Math.max(end, track.start + track.duration);
  }
  return roundTimelineValue(end);
}

/**
 * Thời điểm kết thúc muộn nhất của mọi caption token.
 * Caption là nội dung timeline hiển thị.
 */
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

/**
 * Derive duration timeline từ điểm kết thúc visual/audio/caption.
 * Trả về `0` khi timeline không có nội dung.
 */
export function deriveTimelineDurationV3(timeline: ProjectTimelineV3): number {
  return roundTimelineValue(
    Math.max(
      getVisualTimelineEndV3(timeline),
      getAudioTimelineEndV3(timeline),
      getCaptionTimelineEndV3(timeline),
    ),
  );
}

/**
 * Timeline có bất kỳ nội dung visual/audio/caption hay không.
 */
export function hasTimelineContentV3(timeline: ProjectTimelineV3): boolean {
  return (
    timeline.visualTracks.some((track) => track.clips.length > 0) ||
    timeline.audioTracks.length > 0 ||
    timeline.captionTracks.some((track) => track.tokens.length > 0)
  );
}
