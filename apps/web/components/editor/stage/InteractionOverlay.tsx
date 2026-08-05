"use client";

import {
  hitTestRenderSnapshot,
  type RenderSnapshot,
  type RenderSnapshotItem,
} from "@motionvideo/motion-runtime";
import {
  selectionNone,
  selectionNode,
} from "@/lib/editor/model/editor-selection";
import { useEditorStore } from "@/lib/editor/editor-store";
import { useCallback, useMemo, useRef, useState, type PointerEvent } from "react";

type Props = {
  snapshot: RenderSnapshot | null;
  compositionWidth: number;
  compositionHeight: number;
};

function percentBounds(item: RenderSnapshotItem, width: number, height: number) {
  return {
    left: `${(item.worldBounds.x / width) * 100}%`,
    top: `${(item.worldBounds.y / height) * 100}%`,
    width: `${(Math.max(1, item.worldBounds.width) / width) * 100}%`,
    height: `${(Math.max(1, item.worldBounds.height) / height) * 100}%`,
  };
}

/**
 * Editor-only overlay — never exported with Remotion composition.
 * Hit-testing reads RenderSnapshot, not DOM targets.
 */
export function InteractionOverlay({
  snapshot,
  compositionWidth,
  compositionHeight,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [cycleIndex, setCycleIndex] = useState(0);
  const selection = useEditorStore((s) => s.selection);

  const selectedItem = useMemo(() => {
    if (!snapshot || selection.kind !== "node") return null;
    return (
      snapshot.items.find(
        (item) =>
          item.sceneId === selection.sceneId &&
          item.nodeId === selection.nodeId,
      ) ?? null
    );
  }, [snapshot, selection]);

  const hoverItem = useMemo(() => {
    if (!snapshot || !hoverKey) return null;
    return snapshot.items.find((item) => item.key === hoverKey) ?? null;
  }, [snapshot, hoverKey]);

  const toCompositionPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return {
        x: ((clientX - rect.left) / rect.width) * compositionWidth,
        y: ((clientY - rect.top) / rect.height) * compositionHeight,
      };
    },
    [compositionWidth, compositionHeight],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!snapshot) return;
      const point = toCompositionPoint(event.clientX, event.clientY);
      if (!point) return;
      const hits = hitTestRenderSnapshot(snapshot, point);
      setHoverKey(hits[0]?.key ?? null);
    },
    [snapshot, toCompositionPoint],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      if (!snapshot) return;
      event.preventDefault();
      const point = toCompositionPoint(event.clientX, event.clientY);
      if (!point) return;
      const hits = hitTestRenderSnapshot(snapshot, point);
      if (hits.length === 0) {
        useEditorStore.setState({ selection: selectionNone() });
        setCycleIndex(0);
        return;
      }

      const nextIndex =
        event.altKey || event.detail > 1 ? (cycleIndex + 1) % hits.length : 0;
      setCycleIndex(nextIndex);
      const hit = hits[nextIndex]!;
      useEditorStore.setState({
        selection: selectionNode(hit.sceneId, hit.nodeId),
      });
    },
    [snapshot, toCompositionPoint, cycleIndex],
  );

  return (
    <div
      ref={rootRef}
      data-testid="interaction-overlay"
      className="absolute inset-0 z-[2] cursor-default"
      style={{ touchAction: "none" }}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerLeave={() => setHoverKey(null)}
    >
      {hoverItem && hoverItem.key !== selectedItem?.key ? (
        <div
          data-testid="hover-bounds"
          style={{
            position: "absolute",
            ...percentBounds(hoverItem, compositionWidth, compositionHeight),
            border: "1px dashed var(--accent-text)",
            pointerEvents: "none",
            boxSizing: "border-box",
          }}
        />
      ) : null}
      {selectedItem ? (
        <div
          data-testid="selection-bounds"
          style={{
            position: "absolute",
            ...percentBounds(selectedItem, compositionWidth, compositionHeight),
            border: "1.5px solid var(--accent)",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
            pointerEvents: "none",
            boxSizing: "border-box",
          }}
        />
      ) : null}
    </div>
  );
}
