"use client";

import { useCallback, type PointerEvent as ReactPointerEvent } from "react";
import { updateKeyboardSelection } from "@motionvideo/editor-core";
import {
  selectedClipIdsFrom,
  selectionClips,
  type EditorSelection,
  type TimelineClip,
} from "@motionvideo/editor-core/timeline";

type LaneRow = { id: string };

type UseTimelineClipSelectionArgs = {
  selection: EditorSelection;
  rows: LaneRow[];
  clipsByLaneMap: Map<string, TimelineClip[]>;
  onSelect: (selection: EditorSelection) => void;
};

export function useTimelineClipSelection({
  selection,
  rows,
  clipsByLaneMap,
  onSelect,
}: UseTimelineClipSelectionArgs) {
  return useCallback(
    (event: ReactPointerEvent<HTMLElement>, clip: TimelineClip) => {
      const selected = selectedClipIdsFrom(selection);
      const orderedClipIds = rows
        .flatMap((row) => clipsByLaneMap.get(row.id) ?? [])
        .map((candidate) => candidate.id);
      const next = updateKeyboardSelection(orderedClipIds, selected, clip.id, {
        shiftKey: event.shiftKey,
        additiveKey: event.metaKey || event.ctrlKey,
      });
      onSelect(selectionClips(next));
    },
    [clipsByLaneMap, onSelect, rows, selection],
  );
}
