import type { V2Asset } from "@motionvideo/motion-protocol/v2";

export type LibraryShape = "rectangle" | "ellipse" | "polygon";

/** Library item dragged from the editor Text / Shape tools. */
export type LibraryPayload =
  | { kind: "text"; id: string; label: string; text: string; duration?: number }
  | {
      kind: "shape";
      id: string;
      label: string;
      shape: LibraryShape;
      duration?: number;
    }
  | {
      kind: "path";
      id: string;
      label: string;
      duration?: number;
    }
  | {
      kind: "asset";
      id: string;
      label: string;
      asset: V2Asset;
      duration?: number;
    };
