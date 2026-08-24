"use client";

import { useCallback, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useEditorSurface } from "@/components/editor/EditorSurfaceProvider";
import {
  getSelectionBounds,
  buildV2MovePatches,
  getV2LayerBounds,
  isV2LayerActiveAtTime,
  isV2VisualLayer,
  type StageLayerBounds,
} from "@/lib/v2-editor/stage-transform";
import {
  clientToComposition,
  createStageSession,
  type StageSession,
  type StageTransformValues,
} from "@motionvideo/editor-core";
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

function percent(value: number, total: number): string {
  return `${(value / Math.max(1, total)) * 100}%`;
}

function handleStyle(handle: (typeof HANDLES)[number]): CSSProperties {
  const style: CSSProperties = {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 999,
    border: "1px solid var(--bg-site)",
    background: "var(--fg-primary)",
    padding: 0,
    pointerEvents: "none",
  };
  if (handle.includes("n")) style.top = -5;
  if (handle.includes("s")) style.bottom = -5;
  if (handle.includes("w")) style.left = -5;
  if (handle.includes("e")) style.right = -5;
  if (handle === "n" || handle === "s") style.left = "calc(50% - 4px)";
  if (handle === "e" || handle === "w") style.top = "calc(50% - 4px)";
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
  } = useEditorSurface();
  const overlayRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<StageSession | null>(null);
  if (!sessionRef.current) sessionRef.current = createStageSession();
  const activeMoveRef = useRef<{
    primaryId: string;
    bases: Map<string, StageTransformValues>;
  } | null>(null);
  const [moveDelta, setMoveDelta] = useState<{ x: number; y: number } | null>(null);

  const selectedLayers = useMemo(
    () =>
      selectedLayerIds
        .map((id) => document.layers.find((layer) => layer.id === id))
        .filter((layer): layer is V2Layer => Boolean(layer))
        .filter(
        (layer) =>
          isV2VisualLayer(layer) && isV2LayerActiveAtTime(layer, currentTime),
      ),
    [currentTime, document.layers, selectedLayerIds],
  );

  const activeVisualLayers = useMemo(
    () =>
      document.layers
        .filter(
          (layer) =>
            isV2VisualLayer(layer) && isV2LayerActiveAtTime(layer, currentTime),
        )
        .sort((left, right) => right.order - left.order),
    [currentTime, document.layers],
  );

  const selectedDocumentBounds = useMemo(
    () => getSelectionBounds(selectedLayers.map((layer) => getV2LayerBounds(layer))),
    [selectedLayers],
  );

  const selectedBounds = useMemo(() => {
    if (!selectedDocumentBounds || !moveDelta) return selectedDocumentBounds;
    return {
      ...selectedDocumentBounds,
      x: selectedDocumentBounds.x + moveDelta.x,
      y: selectedDocumentBounds.y + moveDelta.y,
    };
  }, [moveDelta, selectedDocumentBounds]);

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

  const layerTransformValues = useCallback((layer: V2Layer): StageTransformValues => ({
    rootLayerId: layer.parentLayerId ?? layer.id,
    layerId: layer.id,
    x: layer.transform.translate.x,
    y: layer.transform.translate.y,
    width: layer.frame.width,
    height: layer.frame.height,
    rotation: layer.transform.rotate.z,
  }), []);

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
    const patches = buildV2MovePatches(
      [...active.bases.keys()]
        .map((id) => document.layers.find((layer) => layer.id === id))
        .filter((layer): layer is V2Layer => Boolean(layer)),
      { x: deltaX, y: deltaY },
    );
    applyCommand({ type: "patch-layers", patches });
  }, [applyCommand, document.layers]);

  const cancelMove = useCallback(() => {
    sessionRef.current?.cancel();
    activeMoveRef.current = null;
    setMoveDelta(null);
  }, []);

  const onMovePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || selectedLayers.length === 0) return;
    const pointer = toCompositionPoint(event.clientX, event.clientY);
    if (!pointer) return;
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
          isV2LayerActiveAtTime(layer, currentTime),
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
  }, [compositionHeight, compositionWidth, currentTime, document.layers, layerTransformValues, selectedLayers, toCompositionPoint]);

  const onMovePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activeMoveRef.current || !sessionRef.current?.interactionId) return;
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

  const onMovePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activeMoveRef.current) return;
    event.preventDefault();
    finishMove();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [finishMove]);

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
            ...boundsStyle(getV2LayerBounds(layer), compositionWidth, compositionHeight),
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
          }}
          onPointerDown={onMovePointerDown}
          onPointerMove={onMovePointerMove}
          onPointerUp={onMovePointerUp}
          onPointerCancel={cancelMove}
        >
          {HANDLES.map((handle) => (
            <span
              key={handle}
              aria-hidden="true"
              data-handle={handle}
              style={handleStyle(handle)}
            />
          ))}
          <span
            aria-hidden="true"
            data-handle="rotate"
            style={{
              position: "absolute",
              left: "calc(50% - 4px)",
              top: -25,
              width: 8,
              height: 8,
              borderRadius: 999,
              border: "1px solid var(--bg-site)",
              background: "var(--fg-primary)",
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              top: -17,
              width: 1,
              height: 12,
              background: "var(--accent)",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
