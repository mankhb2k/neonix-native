import {
  DEFAULT_FRAME_DURATION,
  type FrameDraft,
  type PlacementTarget,
} from "@motionvideo/editor-core";
import type { LibraryPayload } from "./library-payload";

export type LibraryCommitPoint =
  | { mode: "click" }
  | { mode: "drag"; placement: PlacementTarget };

export function libraryPayloadToDraft(payload: LibraryPayload): FrameDraft {
  const duration = payload.duration ?? DEFAULT_FRAME_DURATION;
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
  return {
    id: payload.id,
    name: payload.label,
    role: "text",
    kind: "text",
    duration,
    text: payload.text,
  };
}
