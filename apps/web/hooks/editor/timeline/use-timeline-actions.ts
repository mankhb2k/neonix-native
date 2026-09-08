"use client";

import { useCallback } from "react";
import { useEditorActions } from "@/hooks/editor/use-editor-actions";
import {
  useEditorLocks,
  useEditorSelection,
  useEditorStore,
} from "@/hooks/editor/use-editor-store";
import { canApplyEditorIntent } from "@motionvideo/editor-core";
import {
  selectedClipIdsFrom,
  selectionClips,
  selectionNone,
  timelineActionToDocumentCommand,
  type EditorSelection,
  type TimelineAction,
} from "@motionvideo/editor-core/timeline";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

type UseTimelineActionsArgs = {
  document: MotionProtocolV2;
};

/** Owns timeline-facing selection/actions; global shortcuts live at editor scope. */
export function useTimelineActions({ document }: UseTimelineActionsArgs) {
  const {
    setSelectedLayerIds,
    undo,
    redo,
    deleteSelectedLayers,
    applyCommand,
  } = useEditorActions();
  const selectedLayerIds = useEditorSelection();
  const lockedLayerIds = useEditorLocks();
  const canUndo = useEditorStore((state) => state.undoStack.length > 0);
  const canRedo = useEditorStore((state) => state.redoStack.length > 0);
  const canDelete = canApplyEditorIntent(
    { type: "delete-selection" },
    { document, selectedLayerIds, lockedLayerIds },
  );

  const onSelect = useCallback(
    (next: EditorSelection) => {
      setSelectedLayerIds(
        selectedClipIdsFrom(next).filter((id) => !lockedLayerIds.includes(id)),
      );
    },
    [lockedLayerIds, setSelectedLayerIds],
  );

  const onAction = useCallback(
    (action: TimelineAction) => {
      const command = timelineActionToDocumentCommand(document, action, {
        lockedLayerIds,
      });
      if (command) applyCommand(command);
    },
    [applyCommand, document, lockedLayerIds],
  );

  return {
    selectedLayerIds,
    selectionToEditor: onSelect,
    selectionFromLayers: selectedLayerIds.length > 0
      ? selectionClips(selectedLayerIds)
      : selectionNone(),
    canUndo,
    canRedo,
    canDelete,
    undo,
    redo,
    deleteSelectedLayers,
    onAction,
  };
}
