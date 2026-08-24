import type { FrameDraftShape } from "@motionvideo/editor-core";
import type { V2Asset } from "@motionvideo/motion-protocol/v2";

/** Library item dragged from header Text / Shape (desktop-parity payload). */
export type LibraryPayload =
  | { kind: "text"; id: string; label: string; text: string; duration?: number }
  | {
      kind: "shape";
      id: string;
      label: string;
      shape: FrameDraftShape;
      duration?: number;
    }
  | {
      kind: "asset";
      id: string;
      label: string;
      asset: V2Asset;
      duration?: number;
    };
