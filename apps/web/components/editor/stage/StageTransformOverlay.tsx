"use client";

import { useCallback, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useEditorSurface } from "@/components/editor/EditorSurfaceProvider";
import {
  getSelectionBounds,
  buildV2MovePatches,
  getV2LayerBounds,
  getV2LayerSelectionBox,
  getV2LayerWorldQuad,
  isPointInsideV2Layer,
  isV2LayerActiveAtTime,
  isV2VisualLayer,
  type StageLayerBounds,
} from "@/lib/editor/stage/transform";
import {
  clientToComposition,
  createStageSession,
  selectionBoxFromWorldAndDelta,
  type ResizeHandle,
  type StageSession,
  type StageTransformValues,
} from "@motionvideo/editor-core/interactions/stage";
import type { V2Layer } from "@motionvideo/motion-protocol/v2";

type Props = {
  compositionWidth: number;
  compositionHeight: number;
};

const HANDLES = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
] as const;

const VERTICAL_RESIZE_CURSOR = 'url("/cursor/cursor-vertical.svg") 6 8, ns-resize';
const HORIZONTAL_RESIZE_CURSOR = 'url("/cursor/cursor-horizontal.svg") 8 6, ew-resize';
const DIAGONAL_NW_SE_CURSOR = 'url("/cursor/resize-diagonal-nw-se.svg") 7 7, nwse-resize';
const DIAGONAL_NE_SW_CURSOR = 'url("/cursor/resize-diagonal-ne-sw.svg") 7 7, nesw-resize';
const ROTATE_NW_CURSOR = 'url("/cursor/rotate-nw.svg") 10 10, grab';
const ROTATE_NE_CURSOR = 'url("/cursor/rotate-ne.svg") 10 10, grab';
const ROTATE_SW_CURSOR = 'url("/cursor/rotate-sw.svg") 10 10, grab';
const ROTATE_SE_CURSOR = 'url("/cursor/rotate-se.svg") 10 10, grab';

function percent(value: number, total: number): string {
  return `${(value / Math.max(1, total)) * 100}%`;
}

function handleStyle(handle: (typeof HANDLES)[number]): CSSProperties {
  const style: CSSProperties = {
    position: "absolute",
    width: 16,
    height: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: 'url("/cursor/handle-dot.svg") center / 16px 16px no-repeat',
    color: "var(--fg-primary)",
    padding: 0,
    pointerEvents: "none",
  };
  if (handle.includes("n")) style.top = -8;
  if (handle.includes("s")) style.bottom = -8;
  if (handle.includes("w")) style.left = -8;
  if (handle.includes("e")) style.right = -8;
  if (handle === "n" || handle === "s") style.left = "calc(50% - 8px)";
  if (handle === "e" || handle === "w") style.top = "calc(50% - 8px)";
  if (handle === "n" || handle === "s") style.cursor = VERTICAL_RESIZE_CURSOR;
  if (handle === "e" || handle === "w") style.cursor = HORIZONTAL_RESIZE_CURSOR;
  if (handle === "nw" || handle === "se") style.cursor = DIAGONAL_NW_SE_CURSOR;
  if (handle === "ne" || handle === "sw") style.cursor = DIAGONAL_NE_SW_CURSOR;
  return style;
}

type RotationCorner = "nw" | "ne" | "sw" | "se";

function rotationZoneStyle(corner: RotationCorner): CSSProperties {
  const style: CSSProperties = {
    position: "absolute",
    width: 12,
    height: 12,
    zIndex: 2,
    pointerEvents: "auto",
    touchAction: "none",
  };
  if (corner.includes("n")) style.top = -18;
  if (corner.includes("s")) style.bottom = -18;
  if (corner.includes("w")) style.left = -18;
  if (corner.includes("e")) style.right = -18;
  if (corner === "nw") style.cursor = ROTATE_NW_CURSOR;
  if (corner === "ne") style.cursor = ROTATE_NE_CURSOR;
  if (corner === "sw") style.cursor = ROTATE_SW_CURSOR;
  if (corner === "se") style.cursor = ROTATE_SE_CURSOR;
  return style;
}

function boundsStyle(
  bounds: StageLayerBounds,
  compositionWidth: number,
  compositionHeight: number,
): CSSProperties {
  return {
    position: "absolute",
    left: percent(bounds.x, compositionWidth),
    top: percent(bounds.y, compositionHeight),
    width: percent(Math.max(1, bounds.width), compositionWidth),
    height: percent(Math.max(1, bounds.height), compositionHeight),
    boxSizing: "border-box",
  };
}

function hitboxStyle(layer: V2Layer, compositionWidth: number, compositionHeight: number): CSSProperties {
  const bounds = getV2LayerBounds(layer);
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  const clipPath = getV2LayerWorldQuad(layer)
    .map((point) => `${percent(point.x - bounds.x, width)} ${percent(point.y - bounds.y, height)}`)
    .join(", ");
  return {
    ...boundsStyle(bounds, compositionWidth, compositionHeight),
    clipPath: `polygon(${clipPath})`,
  };
}

function layerTransformValues(layer: V2Layer): StageTransformValues {
  return {
    layerId: layer.id,
    x: layer.transform.translate.x,
    y: layer.transform.translate.y,
    width: layer.frame.width,
    height: layer.frame.height,
    rotation: layer.transform.rotate.z,
    pivotX: layer.transform.translate.x + layer.transform.anchor.x,
    pivotY: layer.transform.translate.y + layer.transform.anchor.y,
  };
}

/** Selection chrome and move interaction positioned over the existing V2 canvas. */
export function StageTransformOverlay({
  compositionWidth,
  compositionHeight,
}: Props) {
  const {
    document,
    currentTime,
    selectedLayerIds,
    setSelectedLayerIds,
    applyCommand,
    hiddenLayerIds,
    lockedLayerIds,
  } = useEditorSurface();
  const hiddenIds = useMemo(() => new Set(hiddenLayerIds), [hiddenLayerIds]);
  const lockedIds = useMemo(() => new Set(lockedLayerIds), [lockedLayerIds]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<StageSession | null>(null);
  if (!sessionRef.current) sessionRef.current = createStageSession();
  const activeMoveRef = useRef<{
    primaryId: string;
    bases: Map<string, StageTransformValues>;
  } | null>(null);
  const activeResizeRef = useRef<{
    layerId: string;
    base: StageTransformValues;
  } | null>(null);
  const activeRotateRef = useRef<{
    layerId: string;
    base: StageTransformValues;
  } | null>(null);
  const [moveDelta, setMoveDelta] = useState<{ x: number; y: number } | null>(null);
  const [resizePreview, setResizePreview] = useState<StageTransformValues | null>(null);
  const [rotatePreview, setRotatePreview] = useState<StageTransformValues | null>(null);

  const selectedLayers = useMemo(
    () =>
      selectedLayerIds
        .map((id) => document.layers.find((layer) => layer.id === id))
        .filter((layer): layer is V2Layer => Boolean(layer))
        .filter(
          (layer) =>
            isV2VisualLayer(layer) &&
            isV2LayerActiveAtTime(layer, currentTime) &&
            !hiddenIds.has(layer.id) &&
            !lockedIds.has(layer.id),
      ),
    [currentTime, document.layers, hiddenIds, lockedIds, selectedLayerIds],
  );

  const activeVisualLayers = useMemo(
    () =>
      document.layers
        .filter(
          (layer) =>
            isV2VisualLayer(layer) && isV2LayerActiveAtTime(layer, currentTime),
        )
        .filter((layer) => !hiddenIds.has(layer.id) && !lockedIds.has(layer.id))
        // Paint/hit-test order follows the DOM: higher order must be later so
        // its transparent hitbox sits above lower layers in overlapping areas.
        .sort((left, right) => left.order - right.order),
    [currentTime, document.layers, hiddenIds, lockedIds],
  );

  const selectedDocumentBounds = useMemo(
    () => getSelectionBounds(selectedLayers.map((layer) => getV2LayerBounds(layer))),
    [selectedLayers],
  );

  const selectedBaseBounds = useMemo(
    () =>
      selectedLayers.length === 1
        ? getV2LayerSelectionBox(selectedLayers[0])
        : selectedDocumentBounds,
    [selectedDocumentBounds, selectedLayers],
  );

  const selectedBounds = useMemo(() => {
    if (!selectedBaseBounds) return null;
    if (resizePreview && selectedLayers.length === 1) {
      const base = layerTransformValues(selectedLayers[0]);
      return selectionBoxFromWorldAndDelta(
        selectedBaseBounds,
        base,
        resizePreview,
      );
    }
    if (rotatePreview && selectedLayers.length === 1) {
      const base = layerTransformValues(selectedLayers[0]);
      return selectionBoxFromWorldAndDelta(
        selectedBaseBounds,
        base,
        rotatePreview,
      );
    }
    if (!moveDelta) return selectedBaseBounds;
    return {
      ...selectedBaseBounds,
      x: selectedBaseBounds.x + moveDelta.x,
      y: selectedBaseBounds.y + moveDelta.y,
    };
  }, [moveDelta, resizePreview, rotatePreview, selectedBaseBounds, selectedLayers]);

  const toCompositionPoint = useCallback((clientX: number, clientY: number) => {
    const overlay = overlayRef.current;
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
  }, [compositionHeight, compositionWidth]);

  const finishMove = useCallback(() => {
    const active = activeMoveRef.current;
    const session = sessionRef.current;
    if (!active || !session) return;
    const result = session.commit("pointerup");
    const primaryPreview = result?.patches[0]?.values;
    const primaryBase = active.bases.get(active.primaryId);
    activeMoveRef.current = null;
    setMoveDelta(null);
    if (!primaryPreview || !primaryBase) return;
    const deltaX = primaryPreview.x - primaryBase.x;
    const deltaY = primaryPreview.y - primaryBase.y;
    if (Math.abs(deltaX) < 1e-6 && Math.abs(deltaY) < 1e-6) return;
    if (active.bases.size === 1 && result?.command) {
      applyCommand(result.command);
      return;
    }
    const patches = buildV2MovePatches(
      [...active.bases.keys()]
        .map((id) => document.layers.find((layer) => layer.id === id))
        .filter((layer): layer is V2Layer => Boolean(layer)),
      { x: deltaX, y: deltaY },
    );
    applyCommand({ type: "patch-layers", patches });
  }, [applyCommand, document.layers]);

  const finishResize = useCallback(() => {
    const active = activeResizeRef.current;
    const session = sessionRef.current;
    if (!active || !session) return;
    const result = session.commit("pointerup");
    const preview = result?.patches[0]?.values;
    activeResizeRef.current = null;
    setResizePreview(null);
    if (!preview || !result?.command) return;
    applyCommand(result.command);
  }, [applyCommand]);

  const finishRotate = useCallback(() => {
    const active = activeRotateRef.current;
    const session = sessionRef.current;
    if (!active || !session) return;
    const result = session.commit("pointerup");
    const preview = result?.patches[0]?.values;
    activeRotateRef.current = null;
    setRotatePreview(null);
    if (!preview || !result?.command) return;
    applyCommand(result.command);
  }, [applyCommand]);

  const cancelMove = useCallback(() => {
    sessionRef.current?.cancel();
    activeMoveRef.current = null;
    activeResizeRef.current = null;
    activeRotateRef.current = null;
    setMoveDelta(null);
    setResizePreview(null);
    setRotatePreview(null);
  }, []);

  const onMovePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || selectedLayers.length === 0) return;
    const pointer = toCompositionPoint(event.clientX, event.clientY);
    if (!pointer) return;
    // The selected bounds sits above transparent hitboxes so it can receive
    // move/resize gestures. Route a click that lands on another visible layer
    // to the highest-order layer under the pointer instead of moving the
    // currently selected full-canvas media layer.
    const hitLayer = [...activeVisualLayers].reverse().find((layer) => {
      return isPointInsideV2Layer(layer, pointer);
    });
    if (hitLayer && !selectedLayers.some((layer) => layer.id === hitLayer.id)) {
      event.preventDefault();
      event.stopPropagation();
      setSelectedLayerIds([hitLayer.id]);
      return;
    }
    const primary = selectedLayers[0];
    const bases = new Map(selectedLayers.map((layer) => [layer.id, layerTransformValues(layer)]));
    const primaryBase = bases.get(primary.id);
    if (!primaryBase) return;
    const selectedIds = new Set(selectedLayers.map((layer) => layer.id));
    const snapLayers = document.layers
      .filter(
        (layer) =>
          !selectedIds.has(layer.id) &&
          isV2VisualLayer(layer) &&
          isV2LayerActiveAtTime(layer, currentTime) &&
          !hiddenIds.has(layer.id) &&
          !lockedIds.has(layer.id),
      )
      .map((layer) => getV2LayerBounds(layer));
    const snapEdgesX = [
      0,
      compositionWidth - primaryBase.width,
      (compositionWidth - primaryBase.width) / 2,
      ...snapLayers.flatMap((bounds) => [
        bounds.x,
        bounds.x + bounds.width - primaryBase.width,
        bounds.x + bounds.width / 2 - primaryBase.width / 2,
      ]),
    ];
    const snapEdgesY = [
      0,
      compositionHeight - primaryBase.height,
      (compositionHeight - primaryBase.height) / 2,
      ...snapLayers.flatMap((bounds) => [
        bounds.y,
        bounds.y + bounds.height - primaryBase.height,
        bounds.y + bounds.height / 2 - primaryBase.height / 2,
      ]),
    ];
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    activeMoveRef.current = { primaryId: primary.id, bases };
    sessionRef.current?.beginMove(
      {
        interactionId: `v2-stage-move-${primary.id}-${Date.now()}`,
        base: primaryBase,
        worldBounds: getV2LayerBounds(primary),
        pointer,
        constraints: {
          snapEdgesX,
          snapEdgesY,
          snapThreshold: 6,
        },
      },
      {
        onPreview: (payload) => {
          const preview = payload.patches[0];
          if (!preview) return;
          setMoveDelta({ x: preview.x - primaryBase.x, y: preview.y - primaryBase.y });
        },
      },
    );
  }, [activeVisualLayers, compositionHeight, compositionWidth, currentTime, document.layers, hiddenIds, lockedIds, selectedLayers, setSelectedLayerIds, toCompositionPoint]);

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLSpanElement>, handle: ResizeHandle) => {
      if (event.button !== 0 || selectedLayers.length !== 1) return;
      const pointer = toCompositionPoint(event.clientX, event.clientY);
      const layer = selectedLayers[0];
      if (!pointer || !layer) return;
      const base = layerTransformValues(layer);
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.parentElement?.setPointerCapture(event.pointerId);
      activeResizeRef.current = { layerId: layer.id, base };
      sessionRef.current?.beginResize(
        {
          interactionId: `v2-stage-resize-${layer.id}-${Date.now()}`,
          base,
          worldBounds: getV2LayerBounds(layer),
          pointer,
          handle,
          constraints: { minSize: 8 },
        },
        {
          onPreview: (payload) => {
            setResizePreview(payload.patches[0] ?? null);
          },
        },
      );
    },
    [selectedLayers, toCompositionPoint],
  );

  const onRotatePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLSpanElement>) => {
      if (event.button !== 0 || selectedLayers.length !== 1) return;
      const pointer = toCompositionPoint(event.clientX, event.clientY);
      const layer = selectedLayers[0];
      if (!pointer || !layer) return;
      const base = layerTransformValues(layer);
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.parentElement?.setPointerCapture(event.pointerId);
      activeRotateRef.current = { layerId: layer.id, base };
      sessionRef.current?.beginRotate(
        {
          interactionId: `v2-stage-rotate-${layer.id}-${Date.now()}`,
          base,
          worldBounds: getV2LayerBounds(layer),
          pointer,
          constraints: { snapThreshold: 2 },
        },
        {
          onPreview: (payload) => {
            setRotatePreview(payload.patches[0] ?? null);
          },
        },
      );
    },
    [selectedLayers, toCompositionPoint],
  );

  const onTransformPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      (!activeMoveRef.current && !activeResizeRef.current && !activeRotateRef.current) ||
      !sessionRef.current?.interactionId
    ) return;
    const pointer = toCompositionPoint(event.clientX, event.clientY);
    if (!pointer) return;
    event.preventDefault();
    sessionRef.current.updatePointer(pointer, {
      shift: event.shiftKey,
      alt: event.altKey,
      meta: event.metaKey,
      ctrl: event.ctrlKey,
    });
  }, [toCompositionPoint]);

  const onTransformPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activeMoveRef.current && !activeResizeRef.current && !activeRotateRef.current) return;
    event.preventDefault();
    if (activeResizeRef.current) finishResize();
    else if (activeRotateRef.current) finishRotate();
    else finishMove();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [finishMove, finishResize, finishRotate]);

  const onStageLayerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, layerId: string) => {
      event.preventDefault();
      event.stopPropagation();
      setSelectedLayerIds([layerId]);
    },
    [setSelectedLayerIds],
  );

  return (
    <div
      ref={overlayRef}
      className="pointer-events-auto absolute inset-0 z-[4] cursor-default"
      data-testid="stage-transform-overlay"
      aria-label="Selected layer transform bounds"
    >
      {activeVisualLayers.map((layer) => (
        <div
          key={`hit-${layer.id}`}
          aria-label={`Select ${layer.id}`}
          data-layer-hit={layer.id}
          style={{
            ...hitboxStyle(layer, compositionWidth, compositionHeight),
            pointerEvents: "auto",
            background: "transparent",
          }}
          onPointerDown={(event) => onStageLayerPointerDown(event, layer.id)}
        />
      ))}
      {selectedBounds ? (
        <div
          data-testid="stage-selection-bounds"
          style={{
            ...boundsStyle(selectedBounds, compositionWidth, compositionHeight),
            border: "1px solid var(--accent)",
            boxShadow: "0 0 0 1px color-mix(in srgb, var(--bg-site) 70%, transparent)",
            pointerEvents: "auto",
            touchAction: "none",
            transform: selectedBounds.rotation ? `rotate(${selectedBounds.rotation}deg)` : undefined,
            transformOrigin: `${percent(selectedBounds.transformOriginX ?? selectedBounds.width / 2, selectedBounds.width)} ${percent(selectedBounds.transformOriginY ?? selectedBounds.height / 2, selectedBounds.height)}`,
          }}
          onPointerDown={onMovePointerDown}
          onPointerMove={onTransformPointerMove}
          onPointerUp={onTransformPointerUp}
          onPointerCancel={cancelMove}
        >
          {HANDLES.map((handle) => (
            <span
              key={handle}
              aria-hidden="true"
              data-handle={handle}
              style={{
                ...handleStyle(handle),
                pointerEvents: selectedLayers.length === 1 ? "auto" : "none",
              }}
              onPointerDown={(event) => onResizePointerDown(event, handle)}
            />
          ))}
          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
            <span
              key={`rotate-${corner}`}
              aria-label={`Rotate ${corner}`}
              data-rotate-handle={corner}
              style={rotationZoneStyle(corner)}
              onPointerDown={onRotatePointerDown}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
