"use client";

import { useCallback, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";

import { stageInteractionStore } from "@/lib/store/stage-interaction-store";
import {
  clientToComposition,
  computeSelectionSnap,
  getSelectionBounds,
  getV2LayerBounds,
  isPointInsideV2Layer,
  type ResizeHandle,
  type StagePoint,
} from "@motionvideo/editor-core/interactions/stage";

import { resizeCursor, rotateCursor, type RotationCorner } from "../shared/stage-cursors";
import {
  buildMoveTransformCommand,
  buildResizePreviewCommand,
  buildRotateTransformCommand,
  layerTransformValues,
} from "./stage-transform-command-adapter";
import { previewStageCommand, cancelStageCommand } from "./transform-lifecycle";
import type { StageTransformSession } from "./use-stage-transform-session";
import type { MotionProtocolV2, V2Layer } from "@motionvideo/motion-protocol/v2";

type Props = {
  compositionWidth: number;
  compositionHeight: number;
  document: MotionProtocolV2;
  currentTime: number;
  selectedLayers: V2Layer[];
  activeVisualLayers: V2Layer[];
  evaluatedLayersById: ReadonlyMap<string, V2Layer>;
  hiddenIds: ReadonlySet<string>;
  lockedIds: ReadonlySet<string>;
  setSelectedLayerIds: (ids: string[]) => void;
  startTextEditing: (layerId: string, point?: { x: number; y: number; mode: "word" }) => void;
  session: StageTransformSession;
};

function hasSelectedAncestor(
  layer: V2Layer,
  selectedIds: ReadonlySet<string>,
  layers: readonly V2Layer[],
): boolean {
  const byId = new Map(layers.map((candidate) => [candidate.id, candidate]));
  let parentId = layer.parentLayerId;
  while (parentId != null) {
    if (selectedIds.has(parentId)) return true;
    parentId = byId.get(parentId)?.parentLayerId ?? null;
  }
  return false;
}

export function useStageTransformPointer({
  compositionWidth,
  compositionHeight,
  document,
  currentTime,
  selectedLayers,
  activeVisualLayers,
  evaluatedLayersById,
  hiddenIds,
  lockedIds,
  setSelectedLayerIds,
  startTextEditing,
  session,
}: Props) {
  const { activeMoveRef, activeResizeRef, activeRotateRef, finishingTransformRef, sessionRef } = session;
  const toCompositionPoint = useCallback((clientX: number, clientY: number): StagePoint | null => {
    const overlay = session.overlayRef.current;
    if (!overlay) return null;
    const rect = overlay.getBoundingClientRect();
    return clientToComposition(
      { x: clientX, y: clientY },
      {
        contentLeft: rect.left,
        contentTop: rect.top,
        contentWidth: rect.width,
        contentHeight: rect.height,
        compositionWidth,
        compositionHeight,
      },
    );
  }, [compositionHeight, compositionWidth, session.overlayRef]);

  const onTextDoubleClick = useCallback((event: MouseEvent<HTMLDivElement>, layerId: string) => {
    const layer = activeVisualLayers.find((candidate) => candidate.id === layerId);
    if (!layer || layer.type !== "text") return;
    event.preventDefault();
    event.stopPropagation();
    session.cancel();
    setSelectedLayerIds([layerId]);
    const point = toCompositionPoint(event.clientX, event.clientY);
    startTextEditing(layerId, point ? { x: point.x, y: point.y, mode: "word" } : undefined);
  }, [activeVisualLayers, session, setSelectedLayerIds, startTextEditing, toCompositionPoint]);

  const onMovePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>, requestedLayerId?: string) => {
    if (event.button !== 0) return;
    const pointer = toCompositionPoint(event.clientX, event.clientY);
    if (!pointer) return;
    const requestedLayer = requestedLayerId
      ? activeVisualLayers.find((layer) => layer.id === requestedLayerId)
      : undefined;
    const hitLayer = requestedLayer ?? [...activeVisualLayers].reverse().find((layer) => isPointInsideV2Layer(layer, pointer));
    let layersToMove = selectedLayers;
    if (hitLayer && !selectedLayers.some((layer) => layer.id === hitLayer.id)) {
      layersToMove = [hitLayer];
      setSelectedLayerIds([hitLayer.id]);
    }
    if (layersToMove.length === 0) return;

    const primary = layersToMove[0];
    if (!primary) return;
    const bases = new Map(layersToMove.map((layer) => [layer.id, layerTransformValues(layer)]));
    const primaryBase = bases.get(primary.id);
    if (!primaryBase) return;
    const moveDocumentBounds = getSelectionBounds(layersToMove.map((layer) => getV2LayerBounds(layer)));
    const selectedIds = new Set(layersToMove.map((layer) => layer.id));
    const selectedParentIds = new Set(layersToMove.map((layer) => layer.parentLayerId));
    const snapTargets = document.layers
      .filter((layer) =>
        !selectedIds.has(layer.id)
        && !hasSelectedAncestor(layer, selectedIds, document.layers)
        && selectedParentIds.has(layer.parentLayerId)
        && evaluatedLayersById.has(layer.id)
        && !hiddenIds.has(layer.id)
        && !lockedIds.has(layer.id),
      )
      .map((layer) => ({ id: layer.id, bounds: getV2LayerBounds(evaluatedLayersById.get(layer.id) ?? layer) }));
    const stageRect = session.overlayRef.current?.getBoundingClientRect();
    const effectiveZoom = stageRect ? stageRect.width / Math.max(1, compositionWidth) : 1;
    const snapThreshold = 6 / Math.max(0.01, effectiveZoom);
    const snapTargetsWithCanvas = [
      { bounds: { x: 0, y: 0, width: compositionWidth, height: compositionHeight } },
      ...snapTargets,
    ];

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    session.setInteractionCursor("default");
    activeMoveRef.current = { primaryId: primary.id, bases };
    sessionRef.current?.beginMove({
      interactionId: `v2-stage-move-${primary.id}-${Date.now()}`,
      base: primaryBase,
      worldBounds: getV2LayerBounds(primary),
      pointer,
      screenPointer: { x: event.clientX, y: event.clientY },
      constraints: {
        snapThreshold,
        snapMove: (next, base) => {
          if (!moveDocumentBounds) return { values: next, guides: [] };
          const rawDelta = { x: next.x - base.x, y: next.y - base.y };
          const snap = computeSelectionSnap(
            { ...moveDocumentBounds, x: moveDocumentBounds.x + rawDelta.x, y: moveDocumentBounds.y + rawDelta.y },
            snapTargetsWithCanvas,
            snapThreshold,
          );
          return { values: { ...next, x: next.x + snap.delta.x, y: next.y + snap.delta.y }, guides: snap.guides };
        },
      },
    }, {
      onPreview: (payload) => {
        const preview = payload.patches[0];
        if (!preview) {
          if (finishingTransformRef.current) return;
          session.setInteractionSelectionBox(null);
          cancelStageCommand(session.previewCommand);
          return;
        }
        const deltaX = preview.x - primaryBase.x;
        const deltaY = preview.y - primaryBase.y;
        if (Math.abs(deltaX) < 1e-6 && Math.abs(deltaY) < 1e-6) {
          session.setInteractionSelectionBox(null);
          cancelStageCommand(session.previewCommand);
          return;
        }
        session.setInteractionSelectionBox(payload.selectionBox);
        const layers = [...(activeMoveRef.current?.bases.keys() ?? [])]
          .map((layerId) => document.layers.find((layer) => layer.id === layerId))
          .filter((layer): layer is V2Layer => Boolean(layer));
        previewStageCommand(
          session.previewCommand,
          buildMoveTransformCommand({ layers, evaluatedLayersById, timeSeconds: currentTime, deltaX, deltaY }),
        );
        stageInteractionStore.setGuides(payload.guides);
      },
    });
  }, [activeMoveRef, activeVisualLayers, compositionHeight, compositionWidth, currentTime, document, evaluatedLayersById, finishingTransformRef, hiddenIds, lockedIds, selectedLayers, setSelectedLayerIds, session, sessionRef, toCompositionPoint]);

  const onResizePointerDown = useCallback((event: ReactPointerEvent<HTMLSpanElement>, handle: ResizeHandle) => {
    if (event.button !== 0 || selectedLayers.length !== 1) return;
    const pointer = toCompositionPoint(event.clientX, event.clientY);
    const layer = selectedLayers[0];
    if (!pointer || !layer) return;
    if (layer.type === "text" && !["nw", "ne", "sw", "se", "e", "w"].includes(handle)) return;
    const base = layerTransformValues(layer);
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.parentElement?.setPointerCapture(event.pointerId);
    activeResizeRef.current = { layerId: layer.id, base, handle };
    session.setInteractionCursor(resizeCursor(handle));
    sessionRef.current?.beginResize({
      interactionId: `v2-stage-resize-${layer.id}-${Date.now()}`,
      base,
      worldBounds: getV2LayerBounds(layer),
      pointer,
      screenPointer: { x: event.clientX, y: event.clientY },
      handle,
      constraints: { minSize: 8, lockAspect: layer.type === "text" && ["nw", "ne", "sw", "se"].includes(handle) },
    }, {
      onPreview: (payload) => {
        const preview = payload.patches[0] ?? null;
        if (!preview) {
          if (finishingTransformRef.current) return;
          session.setInteractionSelectionBox(null);
          cancelStageCommand(session.previewCommand);
          return;
        }
        session.setInteractionSelectionBox(payload.selectionBox);
        const sourceLayer = document.layers.find((candidate) => candidate.id === layer.id);
        const evaluatedLayer = evaluatedLayersById.get(layer.id) ?? layer;
        if (sourceLayer) {
          previewStageCommand(session.previewCommand, buildResizePreviewCommand({
            layer: sourceLayer,
            evaluatedLayer,
            timeSeconds: currentTime,
            base,
            preview,
            handle,
          }));
        }
        stageInteractionStore.setGuides(payload.guides);
      },
    });
  }, [activeResizeRef, currentTime, document, evaluatedLayersById, finishingTransformRef, selectedLayers, session, sessionRef, toCompositionPoint]);

  const onRotatePointerDown = useCallback((event: ReactPointerEvent<HTMLSpanElement>, corner: RotationCorner) => {
    if (event.button !== 0 || selectedLayers.length !== 1) return;
    const pointer = toCompositionPoint(event.clientX, event.clientY);
    const layer = selectedLayers[0];
    if (!pointer || !layer) return;
    const base = layerTransformValues(layer);
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.parentElement?.setPointerCapture(event.pointerId);
    activeRotateRef.current = { layerId: layer.id, base };
    session.setInteractionCursor(rotateCursor(corner));
    sessionRef.current?.beginRotate({
      interactionId: `v2-stage-rotate-${layer.id}-${Date.now()}`,
      base,
      worldBounds: getV2LayerBounds(layer),
      pointer,
      screenPointer: { x: event.clientX, y: event.clientY },
      constraints: { snapAngle: true, snapThreshold: 2 },
    }, {
      onPreview: (payload) => {
        const preview = payload.patches[0] ?? null;
        session.setInteractionSelectionBox(payload.selectionBox);
        const sourceLayer = document.layers.find((candidate) => candidate.id === layer.id);
        const evaluatedLayer = evaluatedLayersById.get(layer.id) ?? layer;
        if (preview && sourceLayer) {
          previewStageCommand(session.previewCommand, buildRotateTransformCommand({
            layer: sourceLayer,
            evaluatedLayer,
            timeSeconds: currentTime,
            rotationDelta: preview.rotation - base.rotation,
          }));
        } else if (!preview && !finishingTransformRef.current) {
          session.setInteractionSelectionBox(null);
          cancelStageCommand(session.previewCommand);
        }
      },
    });
  }, [activeRotateRef, currentTime, document, evaluatedLayersById, finishingTransformRef, selectedLayers, session, sessionRef, toCompositionPoint]);

  const onTransformPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if ((!activeMoveRef.current && !activeResizeRef.current && !activeRotateRef.current) || !sessionRef.current?.interactionId) return;
    const pointer = toCompositionPoint(event.clientX, event.clientY);
    if (!pointer) return;
    event.preventDefault();
    sessionRef.current.updatePointer(
      pointer,
      { shift: event.shiftKey, alt: event.altKey, meta: event.metaKey, ctrl: event.ctrlKey },
      { x: event.clientX, y: event.clientY },
    );
  }, [activeMoveRef, activeResizeRef, activeRotateRef, sessionRef, toCompositionPoint]);

  const onTransformPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activeMoveRef.current && !activeResizeRef.current && !activeRotateRef.current) return;
    event.preventDefault();
    session.clearInteractionCursor();
    if (activeResizeRef.current) void session.finishResize();
    else if (activeRotateRef.current) session.finishRotate();
    else session.finishMove();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, [activeMoveRef, activeResizeRef, activeRotateRef, session]);

  return {
    toCompositionPoint,
    onMovePointerDown,
    onTextDoubleClick,
    onResizePointerDown,
    onRotatePointerDown,
    onTransformPointerMove,
    onTransformPointerUp,
  };
}
