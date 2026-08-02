export type LibraryItemKind = "media" | "text" | "element" | "audio";

export type LibraryItem = {
  id: string;
  kind: LibraryItemKind;
  label: string;
  /** Media/audio asset id when from project document. */
  assetId?: string;
  assetUri?: string;
  text?: string;
  duration?: number;
};
