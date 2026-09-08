import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import type { EditorCommand } from "../../document/commands";

/** Semantic actions emitted by timeline UI controls. */
export type TimelineAction =
  | { type: "toggle-audio"; targetId: string }
  | { type: "toggle-video-audio"; targetId: string }
  | { type: "detach-video-audio"; targetId: string };

export type TimelineActionOptions = {
  lockedLayerIds?: readonly string[];
};

/**
 * Converts a timeline action into a document command.
 *
 * The browser supplies only a semantic target. Document lookup, payload
 * construction, and lock policy stay in the editor-core command layer.
 */
export function timelineActionToDocumentCommand(
  document: MotionProtocolV2,
  action: TimelineAction,
  options: TimelineActionOptions = {},
): EditorCommand | null {
  if (action.type === "toggle-audio") {
    const track = document.audio.tracks.find(
      (candidate) => candidate.id === action.targetId,
    );
    return track
      ? {
          type: "patch-audio-track",
          trackId: track.id,
          patch: { muted: !track.muted },
        }
      : null;
  }

  if (options.lockedLayerIds?.includes(action.targetId)) return null;

  const layer = document.layers.find(
    (candidate) => candidate.id === action.targetId,
  );
  if (!layer || layer.type !== "video") return null;

  if (action.type === "toggle-video-audio") {
    const audio = layer.payload.audio;
    return {
      type: "patch-layer",
      layerId: layer.id,
      patch: {
        payload: {
          audio: {
            enabled: !(audio?.enabled ?? false),
            gainDb: audio?.gainDb ?? 0,
            pan: audio?.pan ?? 0,
            ...(audio?.fadeIn ? { fadeIn: audio.fadeIn } : {}),
            ...(audio?.fadeOut ? { fadeOut: audio.fadeOut } : {}),
          },
        },
      },
    };
  }

  return { type: "detach-video-audio", layerId: layer.id };
}
