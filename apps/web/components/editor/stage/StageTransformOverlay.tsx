"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { flushSync } from "react-dom";
import { useEditorActions } from "@/hooks/editor/use-editor-actions";
import {
  useEditorDocument,
  useEditorLocks,
  useEditorSelection,
  useEditorTextEditSession,
  useEditorVisibility,
} from "@/hooks/editor/use-editor-store";
import { useTransportStore } from "@/hooks/editor/use-transport-store";
import {
  buildPlayheadTransformPatch,
  buildPlayheadTransformPatches,
  evaluateLayerAtPlayhead,
} from "@/lib/editor/animation/keyframes";
import {
  getSelectionBounds,
  getV2LayerBounds,
  getV2LayerSelectionBox,
  getV2LayerWorldQuad,
  isPointInsideV2Layer,
  isV2LayerActiveAtTime,
  isV2VisualLayer,
  type StageLayerBounds,
} from "@/lib/editor/stage/transform";
import {
  measureEditorTextLayer,
  measureEditorTextMinimumWidth,
} from "@/lib/editor/text/measurement";
import {
  buildTextScaleResizeUpdate,
  buildWrappedTextResizeUpdate,
} from "@/lib/editor/text/sizing";
import {
  stageInteractionStore,
  useStagePreviewCommit,
  useStagePreviewOverrides,
  useStageSnapGuides,
} from "@/lib/store/stage-interaction-store";
import {
  clientToComposition,
  computeSelectionSnap,
  createStageSession,
  selectionBoxFromWorldAndDelta,
  type ResizeHandle,
  type StageSession,
  type StageTransformValues,
} from "@motionvideo/editor-core/interactions/stage";
import type { V2Layer } from "@motionvideo/motion-protocol/v2";
import type { TextLayoutMeasurement } from "@motionvideo/motion-runtime";

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

function resizeCursor(handle: ResizeHandle): string {
  if (handle === "n" || handle === "s") return VERTICAL_RESIZE_CURSOR;
  if (handle === "e" || handle === "w") return HORIZONTAL_RESIZE_CURSOR;
  if (handle === "nw" || handle === "se") return DIAGONAL_NW_SE_CURSOR;
  return DIAGONAL_NE_SW_CURSOR;
}

function rotateCursor(corner: RotationCorner): string {
  if (corner === "nw") return ROTATE_NW_CURSOR;
  if (corner === "ne") return ROTATE_NE_CURSOR;
  if (corner === "sw") return ROTATE_SW_CURSOR;
  return ROTATE_SE_CURSOR;
}

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
  if (handle === "n" || handle === "s") {
    style.left = "50%";
    style.transform = "translateX(-50%)";
  }
  if (handle === "e" || handle === "w") {
    style.top = "50%";
    style.transform = "translateY(-50%)";
  }
  style.cursor = resizeCursor(handle);
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
  style.cursor = rotateCursor(corner);
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

function oppositeCornerOrigin(
  bounds: StageLayerBounds,
  handle: ResizeHandle,
): { x: number; y: number } {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  switch (handle) {
    case "nw":
      return { x: right, y: bottom };
    case "ne":
      return { x: bounds.x, y: bottom };
    case "se":
      return { x: bounds.x, y: bounds.y };
    case "sw":
      return { x: right, y: bounds.y };
    default:
      return { x: bounds.x, y: bounds.y };
  }
}

/** Selection chrome and move interaction positioned over the existing V2 canvas. */
export function StageTransformOverlay({
  compositionWidth,
  compositionHeight,
}: Props) {
  const { setSelectedLayerIds, applyCommand, startTextEditing } = useEditorActions();
  const document = useEditorDocument();
  const selectedLayerIds = useEditorSelection();
  const textEditSession = useEditorTextEditSession();
  const hiddenLayerIds = useEditorVisibility();
  const lockedLayerIds = useEditorLocks();
  const currentTime = useTransportStore((state) => state.currentTime);
  const previewOverrides = useStagePreviewOverrides();
  const stagePreviewCommit = useStagePreviewCommit();
  const snapGuides = useStageSnapGuides();
  const hiddenIds = useMemo(() => new Set(hiddenLayerIds), [hiddenLayerIds]);
  const lockedIds = useMemo(() => new Set(lockedLayerIds), [lockedLayerIds]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<StageSession | null>(null);
  const activeCursorRef = useRef<{
    root: string;
    body: string;
    overlay: string;
  } | null>(null);
  const setInteractionCursor = useCallback((cursor: string) => {
    if (typeof globalThis.document === "undefined") return;
    const root = globalThis.document.documentElement;
    const body = globalThis.document.body;
    const overlay = overlayRef.current;
    if (!activeCursorRef.current) {
      activeCursorRef.current = {
        root: root.style.cursor,
        body: body.style.cursor,
        overlay: overlay?.style.cursor ?? "",
      };
    }
    root.style.cursor = cursor;
    body.style.cursor = cursor;
    if (overlay) overlay.style.cursor = cursor;
  }, []);
  const clearInteractionCursor = useCallback(() => {
    const previous = activeCursorRef.current;
    if (!previous || typeof globalThis.document === "undefined") return;
    const root = globalThis.document.documentElement;
    const body = globalThis.document.body;
    root.style.cursor = previous.root;
    body.style.cursor = previous.body;
    if (overlayRef.current) overlayRef.current.style.cursor = previous.overlay;
    activeCursorRef.current = null;
  }, []);
  if (!sessionRef.current) sessionRef.current = createStageSession();
  useEffect(() => {
    return () => {
      sessionRef.current?.cancel();
      stageInteractionStore.clear();
      clearInteractionCursor();
    };
  }, [clearInteractionCursor, document.id]);
  const activeMoveRef = useRef<{
    primaryId: string;
    bases: Map<string, StageTransformValues>;
  } | null>(null);
  const activeResizeRef = useRef<{
    layerId: string;
    base: StageTransformValues;
    handle: ResizeHandle;
  } | null>(null);
  const activeRotateRef = useRef<{
    layerId: string;
    base: StageTransformValues;
  } | null>(null);
  // Stage preview and the canonical editor document are separate external
  // stores. During pointerup, keep the preview alive until the command has
  // been applied so React never paints the old document between the two
  // updates. This mirrors OpenPencil's preview -> commit transaction.
  const finishingTransformRef = useRef(false);
  const pendingCommitRef = useRef(false);
  const [resizePreview, setResizePreview] = useState<StageTransformValues | null>(null);
  const [rotatePreview, setRotatePreview] = useState<StageTransformValues | null>(null);

  useEffect(() => {
    if (stagePreviewCommit.pending || !pendingCommitRef.current) return;
    pendingCommitRef.current = false;
    finishingTransformRef.current = false;
    setResizePreview(null);
    setRotatePreview(null);
  }, [stagePreviewCommit.pending]);

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
      )
        .map((layer) => evaluateLayerAtPlayhead(layer, currentTime)),
    [currentTime, document.layers, hiddenIds, lockedIds, selectedLayerIds],
  );

  const activeVisualLayers = useMemo(
    () =>
      document.layers
        .filter(
          (layer) =>
            isV2VisualLayer(layer) && isV2LayerActiveAtTime(layer, currentTime),
        )
        .map((layer) => evaluateLayerAtPlayhead(layer, currentTime))
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
    const moveDelta = selectedLayers[0]
      ? previewOverrides.get(selectedLayers[0].id)?.translateDelta
      : undefined;
    if (moveDelta && !resizePreview && !rotatePreview) {
      return {
        ...selectedBaseBounds,
        x: selectedBaseBounds.x + moveDelta.x,
        y: selectedBaseBounds.y + moveDelta.y,
      };
    }
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
    return selectedBaseBounds;
  }, [previewOverrides, resizePreview, rotatePreview, selectedBaseBounds, selectedLayers]);

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
    finishingTransformRef.current = true;
    try {
      const result = session.commit("pointerup");
      const primaryPreview = result?.patches[0]?.values;
      const primaryBase = active.bases.get(active.primaryId);
      activeMoveRef.current = null;
      if (!primaryPreview || !primaryBase) return;
      const deltaX = primaryPreview.x - primaryBase.x;
      const deltaY = primaryPreview.y - primaryBase.y;
      if (Math.abs(deltaX) < 1e-6 && Math.abs(deltaY) < 1e-6) return;
      const layers =
        [...active.bases.keys()]
          .map((id) => document.layers.find((layer) => layer.id === id))
          .filter((layer): layer is V2Layer => Boolean(layer));
      const patches = buildPlayheadTransformPatches(
        layers,
        currentTime,
        { translateDelta: { x: deltaX, y: deltaY } },
      );
      pendingCommitRef.current = true;
      stageInteractionStore.beginCommit(document);
      flushSync(() => {
        applyCommand({ type: "patch-layers", patches });
      });
    } finally {
      if (!pendingCommitRef.current) {
        finishingTransformRef.current = false;
        stageInteractionStore.cancelCommit();
        stageInteractionStore.clear();
      }
    }
  }, [applyCommand, currentTime, document]);

  const finishResize = useCallback(async () => {
    const active = activeResizeRef.current;
    const session = sessionRef.current;
    if (!active || !session) return;
    finishingTransformRef.current = true;
    try {
      const result = session.commit("pointerup");
      const preview = result?.patches[0]?.values;
      const layer = document.layers.find((candidate) => candidate.id === active.layerId);
      activeResizeRef.current = null;
      if (!preview || !layer) return;
      const deltaX = preview.x - active.base.x;
      const deltaY = preview.y - active.base.y;
      const isCornerResize = ["nw", "ne", "sw", "se"].includes(active.handle);
      if (layer.type === "text") {
        const evaluatedLayer = evaluateLayerAtPlayhead(layer, currentTime);
        if (evaluatedLayer.type !== "text") return;
        if (isCornerResize) {
          const scale = preview.width / Math.max(0.001, active.base.width);
          const update = buildTextScaleResizeUpdate(
            evaluatedLayer,
            scale,
            { x: preview.x, y: preview.y },
          );
          pendingCommitRef.current = true;
          stageInteractionStore.beginCommit(document);
          flushSync(() => {
            applyCommand({
              type: "patch-layer",
              layerId: layer.id,
              patch: update.patch,
            });
          });
          return;
        }
        const minimumWidth = measureEditorTextMinimumWidth(
          {
            ...document,
            layers: document.layers.map((candidate) =>
              candidate.id === layer.id ? evaluatedLayer : candidate,
            ),
          },
          layer.id,
        );
        const targetWidth = Math.max(8, preview.width, minimumWidth ?? 8);
        const targetX = active.handle === "w"
          ? active.base.x + active.base.width - targetWidth
          : preview.x;
        const measurementPromise = measureEditorTextLayer(
          {
            ...document,
            layers: document.layers.map((candidate) =>
              candidate.id === layer.id
                ? {
                    ...evaluatedLayer,
                    frame: { ...evaluatedLayer.frame, width: targetWidth },
                  }
                : candidate,
            ),
          },
          layer.id,
          { width: targetWidth },
        );
        const measured = await Promise.race([
          measurementPromise,
          new Promise<null>((resolve) => {
            window.setTimeout(() => resolve(null), 1000);
          }),
        ]);
        const lineHeight = evaluatedLayer.payload.layout?.lineHeight
          ?? Number(evaluatedLayer.payload.chunks[0]?.spans[0]?.font.size ?? 64) * 1.2;
        const estimatedLineCount = Math.max(
          1,
          Math.ceil(active.base.width / Math.max(targetWidth, 1)),
        );
        const measurement: TextLayoutMeasurement = measured ?? {
          width: targetWidth,
          height: lineHeight * estimatedLineCount,
          lineCount: estimatedLineCount,
          lines: Array.from({ length: estimatedLineCount }, (_, index) => ({
            advance: targetWidth,
            baseline: lineHeight * (index + 1),
          })),
          ascender: 0,
          descender: 0,
          resolvedFontAssetIds: [],
        };
        const update = buildWrappedTextResizeUpdate(
          evaluatedLayer,
          targetWidth,
          measurement,
          { x: targetX },
        );
        pendingCommitRef.current = true;
        stageInteractionStore.beginCommit(document);
        flushSync(() => {
          applyCommand({
            type: "patch-layer",
            layerId: layer.id,
            patch: update.patch,
          });
        });
        return;
      }
      const patch = buildPlayheadTransformPatch(
        layer,
        currentTime,
        {
          translateDelta: { x: deltaX, y: deltaY },
          frameDelta: {
            width: preview.width - active.base.width,
            height: preview.height - active.base.height,
          },
        },
      );
      pendingCommitRef.current = true;
      stageInteractionStore.beginCommit(document);
      flushSync(() => {
        applyCommand({
          type: "patch-layer",
          layerId: layer.id,
          patch,
        });
      });
    } finally {
      if (!pendingCommitRef.current) {
        finishingTransformRef.current = false;
        stageInteractionStore.cancelCommit();
        setResizePreview(null);
        stageInteractionStore.clear();
      }
    }
  }, [applyCommand, currentTime, document]);

  const finishRotate = useCallback(() => {
    const active = activeRotateRef.current;
    const session = sessionRef.current;
    if (!active || !session) return;
    finishingTransformRef.current = true;
    try {
      const result = session.commit("pointerup");
      const preview = result?.patches[0]?.values;
      activeRotateRef.current = null;
      setRotatePreview(null);
      if (!preview) return;
      const layer = document.layers.find((candidate) => candidate.id === active.layerId);
      if (!layer) return;
      pendingCommitRef.current = true;
      stageInteractionStore.beginCommit(document);
      flushSync(() => {
        applyCommand({
          type: "patch-layer",
          layerId: layer.id,
          patch: buildPlayheadTransformPatch(layer, currentTime, {
            rotationDelta: preview.rotation - active.base.rotation,
          }),
        });
      });
    } finally {
      if (!pendingCommitRef.current) {
        finishingTransformRef.current = false;
        stageInteractionStore.cancelCommit();
        stageInteractionStore.clear();
      }
    }
  }, [applyCommand, currentTime, document]);

  const cancelMove = useCallback(() => {
    clearInteractionCursor();
    stageInteractionStore.clear();
    sessionRef.current?.cancel();
    activeMoveRef.current = null;
    activeResizeRef.current = null;
    activeRotateRef.current = null;
    setResizePreview(null);
    setRotatePreview(null);
  }, [clearInteractionCursor]);

  const onTextDoubleClick = useCallback((
    event: React.MouseEvent<HTMLDivElement>,
    layerId: string,
  ) => {
    const layer = activeVisualLayers.find((candidate) => candidate.id === layerId);
    if (!layer || layer.type !== "text") return;
    event.preventDefault();
    event.stopPropagation();
    cancelMove();
    setSelectedLayerIds([layerId]);
    const point = toCompositionPoint(event.clientX, event.clientY);
    startTextEditing(
      layerId,
      point ? { x: point.x, y: point.y, mode: "word" } : undefined,
    );
  }, [activeVisualLayers, cancelMove, setSelectedLayerIds, startTextEditing, toCompositionPoint]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!activeMoveRef.current && !activeResizeRef.current && !activeRotateRef.current) return;
      event.preventDefault();
      cancelMove();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelMove]);

  const onMovePointerDown = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    requestedLayerId?: string,
  ) => {
    if (event.button !== 0) return;
    const pointer = toCompositionPoint(event.clientX, event.clientY);
    if (!pointer) return;
    // The selected bounds sits above transparent hitboxes so it can receive
    // move/resize gestures. Route a click that lands on another visible layer
    // to the highest-order layer under the pointer instead of moving the
    // currently selected full-canvas media layer.
    const requestedLayer = requestedLayerId
      ? activeVisualLayers.find((layer) => layer.id === requestedLayerId)
      : undefined;
    const hitLayer = requestedLayer ?? [...activeVisualLayers].reverse().find((layer) => {
      return isPointInsideV2Layer(layer, pointer);
    });
    let layersToMove = selectedLayers;
    if (hitLayer && !selectedLayers.some((layer) => layer.id === hitLayer.id)) {
      layersToMove = [hitLayer];
      setSelectedLayerIds([hitLayer.id]);
    }
    if (layersToMove.length === 0) return;
    const primary = layersToMove[0];
    const bases = new Map(layersToMove.map((layer) => [layer.id, layerTransformValues(layer)]));
    const primaryBase = bases.get(primary.id);
    if (!primaryBase) return;
    const moveDocumentBounds = getSelectionBounds(
      layersToMove.map((layer) => getV2LayerBounds(layer)),
    );
    const selectedIds = new Set(layersToMove.map((layer) => layer.id));
    const selectedParentIds = new Set(layersToMove.map((layer) => layer.parentLayerId));
    const snapTargets = document.layers
      .filter(
        (layer) =>
          !selectedIds.has(layer.id) &&
          !hasSelectedAncestor(layer, selectedIds, document.layers) &&
          selectedParentIds.has(layer.parentLayerId) &&
          isV2VisualLayer(layer) &&
          isV2LayerActiveAtTime(layer, currentTime) &&
          !hiddenIds.has(layer.id) &&
          !lockedIds.has(layer.id),
      )
      .map((layer) => ({ id: layer.id, bounds: getV2LayerBounds(layer) }));
    const stageRect = overlayRef.current?.getBoundingClientRect();
    const effectiveZoom = stageRect
      ? stageRect.width / Math.max(1, compositionWidth)
      : 1;
    const snapThreshold = 6 / Math.max(0.01, effectiveZoom);
    const snapTargetsWithCanvas = [
      {
        bounds: {
          x: 0,
          y: 0,
          width: compositionWidth,
          height: compositionHeight,
        },
      },
      ...snapTargets,
    ];
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteractionCursor("grabbing");
    activeMoveRef.current = { primaryId: primary.id, bases };
    sessionRef.current?.beginMove(
      {
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
              {
                ...moveDocumentBounds,
                x: moveDocumentBounds.x + rawDelta.x,
                y: moveDocumentBounds.y + rawDelta.y,
              },
              snapTargetsWithCanvas,
              snapThreshold,
            );
            return {
              values: {
                ...next,
                x: next.x + snap.delta.x,
                y: next.y + snap.delta.y,
              },
              guides: snap.guides,
            };
          },
        },
      },
      {
        onPreview: (payload) => {
          const preview = payload.patches[0];
          if (!preview) {
            if (finishingTransformRef.current) return;
            stageInteractionStore.clear();
            return;
          }
          const deltaX = preview.x - primaryBase.x;
          const deltaY = preview.y - primaryBase.y;
          if (Math.abs(deltaX) < 1e-6 && Math.abs(deltaY) < 1e-6) {
            stageInteractionStore.clear();
            return;
          }
          stageInteractionStore.setPreview(
            new Map(
              [...(activeMoveRef.current?.bases.keys() ?? [])].map((layerId) => [
                layerId,
                { translateDelta: { x: deltaX, y: deltaY } },
              ]),
            ),
            payload.guides,
          );
        },
      },
    );
  }, [activeVisualLayers, compositionHeight, compositionWidth, currentTime, document.layers, hiddenIds, lockedIds, selectedLayers, setSelectedLayerIds, setInteractionCursor, toCompositionPoint]);

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLSpanElement>, handle: ResizeHandle) => {
      if (event.button !== 0 || selectedLayers.length !== 1) return;
      const pointer = toCompositionPoint(event.clientX, event.clientY);
      const layer = selectedLayers[0];
      if (!pointer || !layer) return;
      if (
        layer.type === "text" &&
        !["nw", "ne", "sw", "se", "e", "w"].includes(handle)
      ) return;
      const base = layerTransformValues(layer);
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.parentElement?.setPointerCapture(event.pointerId);
      activeResizeRef.current = {
        layerId: layer.id,
        base,
        handle,
      };
      setInteractionCursor(resizeCursor(handle));
      sessionRef.current?.beginResize(
        {
          interactionId: `v2-stage-resize-${layer.id}-${Date.now()}`,
          base,
          worldBounds: getV2LayerBounds(layer),
          pointer,
          screenPointer: { x: event.clientX, y: event.clientY },
          handle,
          constraints: {
            minSize: 8,
            lockAspect: layer.type === "text" && ["nw", "ne", "sw", "se"].includes(handle),
          },
        },
        {
          onPreview: (payload) => {
            const preview = payload.patches[0] ?? null;
            if (!preview) {
              if (finishingTransformRef.current) return;
              setResizePreview(null);
              stageInteractionStore.clear();
              return;
            }
            setResizePreview(preview);
            const selectedLayer = selectedLayers[0];
            const isCornerResize = ["nw", "ne", "sw", "se"].includes(handle);
            if (!selectedLayer || !isCornerResize) {
              stageInteractionStore.setPreview(new Map(), payload.guides);
              return;
            }
            const baseBounds = getV2LayerSelectionBox(selectedLayer);
            const scaleX = preview.width / Math.max(0.001, activeResizeRef.current?.base.width ?? preview.width);
            const scaleY = preview.height / Math.max(0.001, activeResizeRef.current?.base.height ?? preview.height);
            stageInteractionStore.setPreview(
              new Map([[
                selectedLayer.id,
                {
                  translateDelta: { x: 0, y: 0 },
                  scaleMultiplier: { x: scaleX, y: scaleY },
                  scaleOrigin: oppositeCornerOrigin(baseBounds, handle),
                },
              ]]),
              payload.guides,
            );
          },
        },
      );
    },
    [selectedLayers, setInteractionCursor, toCompositionPoint],
  );

  const onRotatePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLSpanElement>, corner: RotationCorner) => {
      if (event.button !== 0 || selectedLayers.length !== 1) return;
      const pointer = toCompositionPoint(event.clientX, event.clientY);
      const layer = selectedLayers[0];
      if (!pointer || !layer) return;
      const base = layerTransformValues(layer);
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.parentElement?.setPointerCapture(event.pointerId);
      activeRotateRef.current = { layerId: layer.id, base };
      setInteractionCursor(rotateCursor(corner));
      sessionRef.current?.beginRotate(
        {
          interactionId: `v2-stage-rotate-${layer.id}-${Date.now()}`,
          base,
          worldBounds: getV2LayerBounds(layer),
          pointer,
          screenPointer: { x: event.clientX, y: event.clientY },
          constraints: { snapThreshold: 2 },
        },
        {
          onPreview: (payload) => {
            setRotatePreview(payload.patches[0] ?? null);
          },
        },
      );
    },
    [selectedLayers, setInteractionCursor, toCompositionPoint],
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
    }, { x: event.clientX, y: event.clientY });
  }, [toCompositionPoint]);

  const onTransformPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activeMoveRef.current && !activeResizeRef.current && !activeRotateRef.current) return;
    event.preventDefault();
    clearInteractionCursor();
    if (activeResizeRef.current) void finishResize();
    else if (activeRotateRef.current) finishRotate();
    else finishMove();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [clearInteractionCursor, finishMove, finishResize, finishRotate]);

  return (
    <div
      ref={overlayRef}
      className="pointer-events-auto absolute inset-0 z-[4] cursor-default"
      data-testid="stage-transform-overlay"
      aria-label="Selected layer transform bounds"
    >
      {snapGuides.map((guide) => {
        if (guide.kind === "vline") {
          const from = guide.from ?? 0;
          const to = guide.to ?? compositionHeight;
          return (
            <div
              key={`snap-v-${guide.x}-${guide.from ?? 0}-${guide.to ?? compositionHeight}-${guide.targetId ?? "canvas"}`}
              data-testid="stage-snap-guide"
              data-axis="x"
              style={{
                position: "absolute",
                left: percent(guide.x, compositionWidth),
                top: percent(from, compositionHeight),
                width: 1,
                height: percent(Math.max(1, to - from), compositionHeight),
                background: "var(--accent)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          );
        }
        if (guide.kind === "hline") {
          const from = guide.from ?? 0;
          const to = guide.to ?? compositionWidth;
          return (
            <div
              key={`snap-h-${guide.y}-${guide.from ?? 0}-${guide.to ?? compositionWidth}-${guide.targetId ?? "canvas"}`}
              data-testid="stage-snap-guide"
              data-axis="y"
              style={{
                position: "absolute",
                left: percent(from, compositionWidth),
                top: percent(guide.y, compositionHeight),
                width: percent(Math.max(1, to - from), compositionWidth),
                height: 1,
                background: "var(--accent)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          );
        }
        return null;
      })}
      {activeVisualLayers.map((layer) => (
        textEditSession?.layerId === layer.id ? null :
        <div
          key={`hit-${layer.id}`}
          aria-label={`Select ${layer.id}`}
          data-layer-hit={layer.id}
          style={{
            ...hitboxStyle(layer, compositionWidth, compositionHeight),
            pointerEvents: "auto",
            background: "transparent",
          }}
          onPointerDown={(event) => onMovePointerDown(event, layer.id)}
          onDoubleClick={(event) => onTextDoubleClick(event, layer.id)}
          onPointerMove={onTransformPointerMove}
          onPointerUp={onTransformPointerUp}
          onPointerCancel={cancelMove}
        />
      ))}
      {selectedBounds ? (
        <div
          data-testid="stage-selection-bounds"
          style={{
            ...boundsStyle(selectedBounds, compositionWidth, compositionHeight),
            outline: "1px solid var(--accent)",
            boxShadow: "0 0 0 1px color-mix(in srgb, var(--bg-site) 70%, transparent)",
            pointerEvents: textEditSession ? "none" : "auto",
            touchAction: "none",
            transform: selectedBounds.rotation ? `rotate(${selectedBounds.rotation}deg)` : undefined,
            transformOrigin: `${percent(selectedBounds.transformOriginX ?? selectedBounds.width / 2, selectedBounds.width)} ${percent(selectedBounds.transformOriginY ?? selectedBounds.height / 2, selectedBounds.height)}`,
          }}
          onPointerDown={onMovePointerDown}
          onDoubleClick={(event) => {
            const layer = selectedLayers[0];
            if (layer?.type === "text") onTextDoubleClick(event, layer.id);
          }}
          onPointerMove={onTransformPointerMove}
          onPointerUp={onTransformPointerUp}
          onPointerCancel={cancelMove}
        >
          {HANDLES.map((handle) => {
            if (
              selectedLayers[0]?.type === "text" &&
              !["nw", "ne", "sw", "se", "e", "w"].includes(handle)
            ) return null;
            return (
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
            );
          })}
          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
            <span
              key={`rotate-${corner}`}
              aria-label={`Rotate ${corner}`}
              data-rotate-handle={corner}
              style={rotationZoneStyle(corner)}
              onPointerDown={(event) => onRotatePointerDown(event, corner)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
