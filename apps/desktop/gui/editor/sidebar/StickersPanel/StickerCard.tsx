import type { LibraryCommitPoint } from "../../library/adapters/commit-library-payload";
import type { LibraryPayload } from "../../library/model/library-payload";
import { useLibraryPointerGesture } from "../../library/hooks/use-library-pointer-gesture";
import { PresetTile } from "../../../ui";
import { resolveStickerUrl } from "./sticker-provider";
import type { StickerItem } from "./types";

export function StickerCard({
  item,
  onCommit,
}: {
  item: StickerItem;
  onCommit: (payload: LibraryPayload, point: LibraryCommitPoint) => void;
}) {
  const imageUrl = resolveStickerUrl(item);

  const payload: LibraryPayload = {
    kind: "image",
    id: item.id,
    label: item.name,
    uri: imageUrl,
    duration: 3,
  };

  const { onPointerDown, onKeyDown } = useLibraryPointerGesture(
    payload,
    onCommit
  );

  return (
    <PresetTile
      title={item.name}
      paddingClassName="p-1.5"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <img
        src={imageUrl}
        alt={item.name}
        className="h-full w-full object-contain pointer-events-none drop-shadow-sm select-none"
        loading="lazy"
      />
    </PresetTile>
  );
}
