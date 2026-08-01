/**
 * Slice a MotionScene to a local-time window for export bake.
 */

import type { MotionClip, MotionScene } from "@motionvideo/motion-schema";

function shiftClipSource(
  source: MotionClip["source"],
  localStart: number,
): MotionClip["source"] {
  if (source.kind !== "tracks") return source;
  return {
    ...source,
    tracks: source.tracks.map((track) => ({
      ...track,
      keys: track.keys.map((key) => ({
        ...key,
        t: Math.max(0, key.t - localStart),
      })),
    })),
  };
}

function shiftClip(clip: MotionClip, localStart: number): MotionClip {
  const source = shiftClipSource(clip.source, localStart);
  if (clip.schedule.kind === "absolute") {
    return {
      ...clip,
      schedule: {
        kind: "absolute",
        at: Math.max(0, clip.schedule.at - localStart),
      },
      source,
    };
  }
  return { ...clip, source };
}

export function sliceScene(
  scene: MotionScene,
  localStart: number,
  duration: number,
): MotionScene {
  const start = Math.max(0, localStart);
  const dur = Math.max(0.001, duration);
  const cloned = JSON.parse(JSON.stringify(scene)) as MotionScene;
  const clips = (cloned.clips ?? []).map((clip) => shiftClip(clip, start));
  return {
    ...cloned,
    duration: dur,
    clips,
  };
}

export function clipLocalTime(
  startTime: number,
  clipDuration: number,
  time: number,
): number {
  return Math.min(
    Math.max(0, time - startTime),
    Math.max(0, clipDuration - 1e-6),
  );
}
