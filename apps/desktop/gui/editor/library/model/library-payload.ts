export type LibraryPayload =
  | { kind: "text"; id: string; label: string; text: string; duration?: number }
  | {
      kind: "shape";
      id: string;
      label: string;
      shape: "rectangle" | "ellipse" | "polygon";
      duration?: number;
    }
  | {
      kind: "image";
      id: string;
      label: string;
      assetId: string;
      uri?: string;
      duration?: number;
    }
  | {
      kind: "video";
      id: string;
      label: string;
      assetId: string;
      uri?: string;
      duration?: number;
    }
  | {
      kind: "audio";
      id: string;
      label: string;
      assetId: string;
      uri?: string;
      duration?: number;
    };
