import type { FrameDraftShape } from "@motionvideo/editor-core";

/** Library item dragged from header Text / Shape (desktop-parity payload). */
export type LibraryPayload =
  | { kind: "text"; id: string; label: string; text: string; duration?: number }
  | {
      kind: "shape";
      id: string;
      label: string;
      shape: FrameDraftShape;
      duration?: number;
    };
