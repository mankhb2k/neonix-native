import type { TimelineCommand } from "@motionvideo/editor-core";
import { commitLibraryPayload } from "../../library/adapters/commit-library-payload";
import { useLibraryPointerGesture } from "../../library/hooks/use-library-pointer-gesture";
import type { LibraryCommitPoint } from "../../library/adapters/commit-library-payload";
import type { LibraryPayload } from "../../library/model/library-payload";

import type { ShapeItem, ShapeCategory } from "./shapes/types";
import { BASIC_SHAPES_CATEGORY } from "./shapes/basic";
import { POLYGON_SHAPES_CATEGORY } from "./shapes/polygons";
import { STAR_SHAPES_CATEGORY } from "./shapes/stars";
import { BLOCK_ARROW_SHAPES_CATEGORY } from "./shapes/block-arrows";
import { LINE_SHAPES_CATEGORY } from "./shapes/lines";

const ALL_SHAPE_CATEGORIES: ShapeCategory[] = [
  BASIC_SHAPES_CATEGORY,
  POLYGON_SHAPES_CATEGORY,
  STAR_SHAPES_CATEGORY,
  BLOCK_ARROW_SHAPES_CATEGORY,
  LINE_SHAPES_CATEGORY,
];

type Props = {
  onExecuteTimeline: (command: TimelineCommand, label: string) => void;
};

function ShapePresetItem({
  item,
  onCommit,
}: {
  item: ShapeItem;
  onCommit: (payload: LibraryPayload, point: LibraryCommitPoint) => void;
}) {
  const { onPointerDown, onKeyDown } = useLibraryPointerGesture(
    item.payload,
    onCommit
  );

  return (
    <button
      type="button"
      title={item.label}
      aria-label={item.label}
      className="group relative flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-xl bg-[#222225] p-3 text-white transition-all hover:bg-[#2c2c30] active:scale-95 shadow-sm"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      {item.icon}
    </button>
  );
}

export function ShapesPanel({ onExecuteTimeline }: Props) {
  const onCommit = (payload: LibraryPayload, point: LibraryCommitPoint) => {
    commitLibraryPayload(payload, point, onExecuteTimeline);
  };

  return (
    <div className="flex flex-col gap-5 p-3">
      {ALL_SHAPE_CATEGORIES.map((category) => (
        <div key={category.title} className="flex flex-col gap-2">
          <h4 className="text-[12px] font-semibold text-[var(--fg-primary)]">
            {category.title}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {category.items.map((item) => (
              <ShapePresetItem
                key={item.id}
                item={item}
                onCommit={onCommit}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
