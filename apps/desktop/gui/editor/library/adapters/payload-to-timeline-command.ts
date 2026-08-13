import {
  DEFAULT_FRAME_DURATION,
  type FrameDraft,
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

function draftFromPayload(payload: LibraryPayload): FrameDraft | null {
  switch (payload.kind) {
    case "text":
      return {
        id: draftId(payload),
        name: payload.label,
        role: "text",
        kind: "text",
        duration: payload.duration ?? DEFAULT_FRAME_DURATION,
        text: payload.text,
      };
    case "shape":
      return {
        id: draftId(payload),
        name: payload.label,
        role: "shape",
        kind: "shape",
        shape: payload.shape,
        duration: payload.duration ?? DEFAULT_FRAME_DURATION,
        text: payload.label,
      };
    case "image":
    case "video":
      return {
        id: draftId(payload),
        name: payload.label,
        role: "media",
        kind: payload.kind,
        assetId: payload.assetId,
        duration: payload.duration ?? DEFAULT_FRAME_DURATION,
        text: payload.label,
      };
    case "audio":
      return null;
    default: {
      const _exhaustive: never = payload;
      void _exhaustive;
      return null;
    }
  }
}

function layerNodeCommit(
  payload: LibraryPayload,
  target: PlacementTarget,
): PayloadCommit | null {
  if (!target.layerSceneId) return null;
  const draft = draftFromPayload(payload);
  if (!draft) return null;
  const containerStart = target.layerContainerStart ?? 0;
  const containerDuration = Math.max(
    0.001,
    target.layerContainerDuration ?? draft.duration,
  );
  const parentSceneStart = Math.max(0, target.layerParentSceneStart ?? 0);
  const parentDuration = Math.max(
    0.001,
    target.layerParentDuration ?? containerDuration,
  );
  const globalStart = Math.max(0, target.startTime ?? containerStart);
  const localStart = Math.max(
    0,
    Math.min(
      Math.max(0, parentDuration - 0.001),
      globalStart - containerStart - parentSceneStart,
    ),
  );
  // Layer mode: full-height stack strips — new node spans remaining container.
  const localDuration = Math.max(0.001, parentDuration - localStart);
  const zIndex =
    target.insertOrder != null && Number.isFinite(target.insertOrder)
      ? Math.floor(target.insertOrder)
      : undefined;
  return {
    command: {
      type: "add-scene-node",
      sceneId: target.layerSceneId,
      draft,
      timing: { start: localStart, duration: localDuration },
      zIndex,
      parentLayerId: target.layerParentId,
    },
    label: `Add layer ${payload.label}`,
  };
}

/**
 * Map a typed library payload to a TimelineCommand.
 * Image/video use MotionScene image/video layers via FrameDraft.kind + assetId
 * (image/video node schemas). Audio uses add-audio-clip.
 * Layer mode (`target.layerSceneId`) → `add-scene-node`.
 */
export function payloadToTimelineCommand(
  payload: LibraryPayload,
  target?: PlacementTarget,
): PayloadCommit {
  if (target?.layerSceneId) {
    const layer = layerNodeCommit(payload, target);
    if (layer) return layer;
    throw new Error(`Cannot add ${payload.kind} as a scene layer`);
  }

  switch (payload.kind) {
    case "text":
      return {
        command: {
          type: "add-clip-draft",
          draft: draftFromPayload(payload)!,
          target: target ?? { track: "main" },
        },
        label: `Add ${payload.label}`,
      };

    case "shape":
      return {
        command: {
          type: "add-clip-draft",
          draft: draftFromPayload(payload)!,
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
          draft: draftFromPayload(payload)!,
          target: target ?? { track: "main" },
        },
        label: `Add ${payload.label}`,
      };

    default: {
      const _exhaustive: never = payload;
      throw new Error(
        `Unsupported library payload: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
}
