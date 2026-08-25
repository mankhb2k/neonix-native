import type { FrameDraft, PlacementTarget } from "@motionvideo/editor-core/timeline";
import type { LibraryPayload } from "./library-payload";

export type LibraryCommitPoint =
  | { mode: "click" }
  | { mode: "drag"; placement: PlacementTarget };

export function libraryPayloadToDraft(payload: LibraryPayload): FrameDraft {
  const duration = payload.duration ?? 5;
  if (payload.kind === "shape") {
    return {
      id: payload.id,
      name: payload.label,
      role: "shape",
      kind: "shape",
      shape: payload.shape,
      duration,
      text: payload.label,
    };
  }
  if (payload.kind === "asset") {
    return {
      id: payload.id,
      name: payload.label,
      role: payload.asset.kind,
      kind: payload.asset.kind === "audio" ? "video" : payload.asset.kind,
      duration,
      text: payload.label,
      assetId: payload.asset.id,
    };
  }
  return {
    id: payload.id,
    name: payload.label,
    role: "text",
    kind: "text",
    duration,
    text: payload.text,
  };
}
