import type { LayerMotionUnit } from "@motionvideo/motion-protocol/internal";
import { V1 } from "@motionvideo/motion-protocol";

export function timelineClipsToMotionUnits(
  clips: V1.TimelinePropertyClipV1[] | undefined,
): LayerMotionUnit[] {
  return (clips ?? []).map((clip) => {
    const maxT = Math.max(...clip.keys.map((key) => key.t), 0);
    return {
      id: clip.id,
      layerId: clip.layerId,
      schedule: { kind: "absolute", at: 0 },
      duration: Math.max(maxT, 1e-6),
      playback: { rate: 1, iterations: 1, direction: "normal" },
      source: {
        kind: "tracks",
        tracks: [
          {
            layerId: clip.layerId,
            property: clip.property,
            keys: clip.keys.map((key) => ({
              t: key.t,
              v: key.value,
              ...(key.easing !== undefined ? { easing: key.easing } : {}),
            })),
          },
        ],
      },
    };
  });
}
