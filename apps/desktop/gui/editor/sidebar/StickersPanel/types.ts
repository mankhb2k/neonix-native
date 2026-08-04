import type { LibraryPayload } from "../../library/model/library-payload";

export type StickerItem = {
  id: string;
  name: string;
  category: string;
  cdnPath: string;
  localUrl: string;
  tags?: string[];
  isPro?: boolean;
};

export type StickerCategory = {
  id: string;
  name: string;
};

export type StickerCardProps = {
  item: StickerItem;
  onCommit: (
    payload: LibraryPayload,
    point: { clientX: number; clientY: number }
  ) => void;
};
