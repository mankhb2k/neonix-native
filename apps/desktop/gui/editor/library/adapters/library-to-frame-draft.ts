import {
  DEFAULT_FRAME_DURATION,
  type FrameDraft,
} from "@motionvideo/editor-core";
import type { LibraryItem } from "../model/library-item";

/** @deprecated Prefer payloadToTimelineCommand with LibraryPayload. */
export function libraryItemToFrameDraft(item: LibraryItem): FrameDraft {
  const isShape = item.kind === "element";
  return {
    id: `draft_${item.id}_${Date.now().toString(36)}`,
    name: item.label,
    role: item.kind === "text" ? "text" : isShape ? "shape" : "media",
    kind: item.kind === "text" ? "text" : isShape ? "shape" : undefined,
    shape: isShape
      ? item.id.includes("circle") || item.id.includes("ellipse")
        ? "ellipse"
        : "rectangle"
      : undefined,
    duration: item.duration ?? DEFAULT_FRAME_DURATION,
    text: item.text ?? item.label,
  };
}
