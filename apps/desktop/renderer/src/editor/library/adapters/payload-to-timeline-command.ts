import {
  DEFAULT_FRAME_DURATION,
  type PlacementTarget,
  type TimelineCommand,
} from "@motionvideo/editor-core";
import type { LibraryPayload } from "../model/library-payload";

export type PayloadCommit = {
  command: TimelineCommand;
  label: string;
};

function draftId(payload: LibraryPayload): string {
  return `draft_${payload.id}_${Date.now().toString(36)}`;
}

/**
 * Map a typed library payload to a TimelineCommand.
 * Image/video use MotionScene image/video nodes via FrameDraft.kind + assetId
 * (schema ImageNodeV2 / VideoNodeV2). Audio uses add-audio-clip.
 */
export function payloadToTimelineCommand(
  payload: LibraryPayload,
  target?: PlacementTarget,
): PayloadCommit {
  switch (payload.kind) {
    case "text":
      return {
        command: {
          type: "add-clip-draft",
          draft: {
            id: draftId(payload),
            name: payload.label,
            role: "text",
            kind: "text",
            duration: payload.duration ?? DEFAULT_FRAME_DURATION,
            text: payload.text,
          },
          target: target ?? { track: "main" },
        },
        label: `Add ${payload.label}`,
      };

    case "shape":
      return {
        command: {
          type: "add-clip-draft",
          draft: {
            id: draftId(payload),
            name: payload.label,
            role: "shape",
            kind: "shape",
            shape: payload.shape,
            duration: payload.duration ?? DEFAULT_FRAME_DURATION,
            text: payload.label,
          },
          target: target ?? { track: "main" },
        },
        label: `Add ${payload.label}`,
      };

    case "audio":
      return {
        command: {
          type: "add-audio-clip",
          item: {
            title: payload.label,
            assetId: payload.assetId,
            src: payload.uri,
            duration: payload.duration ?? DEFAULT_FRAME_DURATION,
          },
          target: target ?? { track: "audio" },
        },
        label: `Add audio ${payload.label}`,
      };

    case "image":
    case "video":
      return {
        command: {
          type: "add-clip-draft",
          draft: {
            id: draftId(payload),
            name: payload.label,
            role: "media",
            kind: payload.kind,
            assetId: payload.assetId,
            duration: payload.duration ?? DEFAULT_FRAME_DURATION,
            text: payload.label,
          },
          target: target ?? { track: "main" },
        },
        label: `Add ${payload.label}`,
      };

    default: {
      const _exhaustive: never = payload;
      throw new Error(`Unsupported library payload: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
