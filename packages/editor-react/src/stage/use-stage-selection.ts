/**
 * Stage selection from RenderSnapshot hit-test (controlled).
 */

import { useCallback, useState } from "react";
import {
  resolveStageHit,
  type StagePoint,
} from "@motionvideo/editor-interactions";
import type { RenderSnapshot, RenderSnapshotItem } from "@motionvideo/motion-runtime";
import {
  selectionNone,
  selectionNode,
  type EditorSelection,
} from "@motionvideo/editor-core";

export type UseStageSelectionArgs = {
  onSelect: (selection: EditorSelection) => void;
};

export function useStageSelection({ onSelect }: UseStageSelectionArgs) {
  const [cycleIndex, setCycleIndex] = useState(0);

  const selectAtPoint = useCallback(
    (
      snapshot: RenderSnapshot,
      point: StagePoint,
      opts?: { cycle?: boolean },
    ): RenderSnapshotItem | null => {
      const hit = resolveStageHit(snapshot, point, {
        cycleOffset: opts?.cycle ? cycleIndex + 1 : 0,
      });
      if (!hit.primary) {
        onSelect(selectionNone());
        setCycleIndex(0);
        return null;
      }
      if (opts?.cycle) {
        setCycleIndex((cycleIndex + 1) % Math.max(1, hit.items.length));
      } else {
        setCycleIndex(0);
      }
      onSelect(selectionNode(hit.primary.sceneId, hit.primary.layerId));
      return hit.primary;
    },
    [cycleIndex, onSelect],
  );

  const clearSelection = useCallback(() => {
    onSelect(selectionNone());
    setCycleIndex(0);
  }, [onSelect]);

  return { cycleIndex, selectAtPoint, clearSelection };
}
