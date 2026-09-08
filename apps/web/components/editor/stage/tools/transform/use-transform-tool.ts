"use client";

import { useEffect, useMemo } from "react";

import { useEditorActions } from "@/hooks/editor/use-editor-actions";
import {
  useEditorDocument,
  useEditorLocks,
  useEditorSelection,
  useEditorTextEditSession,
  useEditorVisibility,
} from "@/hooks/editor/use-editor-store";
import { useStageSnapGuides } from "@/lib/store/stage-interaction-store";
import {
  getSelectionBounds,
  getV2LayerBounds,
  getV2LayerSelectionBox,
} from "@motionvideo/editor-core/interactions/stage";
import { useSelectionTool } from "../selection/use-selection-tool";
import { useStageTransformPointer } from "./use-stage-transform-pointer";
import { useStageTransformSession } from "./use-stage-transform-session";
import type { StageRuntimeSnapshot } from "@/lib/editor/stage/runtime-query";

type StageTransformOptions = {
  compositionWidth: number;
  compositionHeight: number;
  runtimeSnapshot: StageRuntimeSnapshot;
};

export function useTransformTool({
  compositionWidth,
  compositionHeight,
  runtimeSnapshot,
}: StageTransformOptions) {
  const { setSelectedLayerIds, applyCommand, previewCommand, startTextEditing } = useEditorActions();
  const document = useEditorDocument();
  const selectedLayerIds = useEditorSelection();
  const textEditSession = useEditorTextEditSession();
  const hiddenLayerIds = useEditorVisibility();
  const lockedLayerIds = useEditorLocks();
  const { selectedLayers, activeVisualLayers, evaluatedLayersById } = useSelectionTool({
    runtimeSnapshot,
    selectedLayerIds,
    hiddenLayerIds,
    lockedLayerIds,
  });
  const hiddenIds = useMemo(() => new Set(hiddenLayerIds), [hiddenLayerIds]);
  const lockedIds = useMemo(() => new Set(lockedLayerIds), [lockedLayerIds]);
  const session = useStageTransformSession({
    document,
    currentTime: runtimeSnapshot.timeSeconds,
    evaluatedLayersById,
    applyCommand,
    previewCommand,
  });
  const pointer = useStageTransformPointer({
    compositionWidth,
    compositionHeight,
    document,
    currentTime: runtimeSnapshot.timeSeconds,
    selectedLayers,
    activeVisualLayers,
    evaluatedLayersById,
    hiddenIds,
    lockedIds,
    setSelectedLayerIds,
    startTextEditing,
    session,
  });
  const snapGuides = useStageSnapGuides();

  const selectedDocumentBounds = useMemo(
    () => getSelectionBounds(selectedLayers.map((layer) => getV2LayerBounds(layer))),
    [selectedLayers],
  );
  const selectedBaseBounds = useMemo(
    () => selectedLayers.length === 1
      ? getV2LayerSelectionBox(selectedLayers[0])
      : selectedDocumentBounds,
    [selectedDocumentBounds, selectedLayers],
  );
  const selectedBounds = session.interactionSelectionBox ?? selectedBaseBounds;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!session.activeMoveRef.current && !session.activeResizeRef.current && !session.activeRotateRef.current) return;
      event.preventDefault();
      session.cancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [session]);

  return {
    overlayRef: session.overlayRef,
    selectedLayers,
    activeVisualLayers,
    selectedBounds,
    snapGuides,
    textEditLayerId: textEditSession?.layerId,
    onMovePointerDown: pointer.onMovePointerDown,
    onTextDoubleClick: pointer.onTextDoubleClick,
    onResizePointerDown: pointer.onResizePointerDown,
    onRotatePointerDown: pointer.onRotatePointerDown,
    onTransformPointerMove: pointer.onTransformPointerMove,
    onTransformPointerUp: pointer.onTransformPointerUp,
    onCancelMove: session.cancel,
  };
}
