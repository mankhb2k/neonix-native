import {
  DEFAULT_FRAME_DURATION,
  type FrameDraft,
} from "@motionvideo/editor-core";
import type { LibraryItem } from "../model/library-item";

export function libraryItemToFrameDraft(item: LibraryItem): FrameDraft {
  return {
    id: `draft_${item.id}_${Date.now().toString(36)}`,
    name: item.label,
    role: item.kind === "text" ? "text" : item.kind === "element" ? "shape" : "media",
    duration: item.duration ?? DEFAULT_FRAME_DURATION,
    text: item.text ?? item.label,
  };
}
