"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useNodeTransform } from "@/hooks/editor/stage/use-node-transform";
import { useStageHotkeys } from "@/hooks/editor/stage/use-stage-hotkeys";
import { useStagePointerSession } from "@/hooks/editor/stage/use-stage-pointer-session";
import { isElementLocked } from "@/lib/editor/authoring/web-project-envelope";
import { useEditorStore } from "@/lib/editor/editor-store";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { resolvePreviewProject } from "@/lib/editor/preview/preview-project";
import {
  selectionNone,
  selectionNode,
  visualTracksToTimelineClips,
  findNode,
  rootLayerIdOf,
} from "@motionvideo/editor-core";
import {
  clientToComposition,
  resolveStageHit,
  selectionBoxFromWorldAndDelta,
  type ResizeHandle,
} from "@motionvideo/editor-interactions";
import type { RenderSnapshot } from "@motionvideo/motion-runtime";

type Props = {
  snapshot: RenderSnapshot | null;
  compositionWidth: number;
  compositionHeight: number;
};

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

function percentBox(
  x: number,
  y: number,
  w: number,
  h: number,
  cw: number,
  ch: number,
) {
  return {
    left: `${(x / cw) * 100}%`,
    top: `${(y / ch) * 100}%`,
    width: `${(Math.max(1, w) / cw) * 100}%`,
    height: `${(Math.max(1, h) / ch) * 100}%`,
  };
}

export function InteractionOverlay({
  snapshot,
  compositionWidth,
  compositionHeight,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [cycleIndex, setCycleIndex] = useState(0);
  const selection = useEditorStore((s) => s.selection);
  const project = useEditorStore((s) => s.project);
  const envelope = useEditorStore((s) => s.envelope);
  const commitNodeTransform = useEditorStore((s) => s.commitNodeTransform);

  const {
    mode,
    preview,
    base,
    beginMove,
    beginResize,
    beginRotate,
    updatePointer,
    cancel,
    commit,
  } = useStagePointerSession();

  const { startMove, startResize, startRotate } = useNodeTransform({
    beginMove,
    beginResize,
    beginRotate,
  });

  const selectedItem = useMemo(() => {
    if (!snapshot || selection.kind !== "node") return null;
    return (
      snapshot.items.find((item) => item.layerId === selection.layerId) ?? null
    );
  }, [snapshot, selection]);

  const hoverItem = useMemo(() => {
    if (!snapshot || !hoverKey) return null;
    return snapshot.items.find((item) => item.key === hoverKey) ?? null;
  }, [snapshot, hoverKey]);

  const previewBox = useMemo(() => {
    if (!selectedItem) return null;
    if (!preview || !base || preview.layerId !== selectedItem.layerId) {
      return selectedItem.worldBounds;
    }
    return selectionBoxFromWorldAndDelta(
      selectedItem.worldBounds,
      base,
      preview,
    );
  }, [selectedItem, preview, base]);

  const toCompositionPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
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
    },
    [compositionWidth, compositionHeight],
  );

  const resolveNodeBase = useCallback(
    (layerId: string) => {
      if (!project) return null;
      const rootLayerId = rootLayerIdOf(project, layerId) ?? layerId;
      const node = findNode(project, rootLayerId, layerId);
      if (!node || !("transform" in node) || !node.transform) return null;
      return {
        rootLayerId,
        layerId,
        x: node.transform.translate.x,
        y: node.transform.translate.y,
        width: "frame" in node ? node.frame.width : 0,
        height: "frame" in node ? node.frame.height : 0,
        rotation: node.transform.rotate.z,
      };
    },
    [project],
  );

  const finishGesture = useCallback(() => {
    const committed = commit();
    const values = committed?.patches[0]?.values;
    if (!values || !project) return;

    const resolved = resolvePreviewProject(project);
    if (resolved.usingDemo) {
      const { lanes, clips } = visualTracksToTimelineClips(resolved.project);
      useEditorStore.setState({
        project: resolved.project,
        timelineLanes: lanes,
        timelineClips: clips,
      });
    }

    commitNodeTransform(values.rootLayerId, values.layerId, {
      x: values.x,
      y: values.y,
      width: values.width,
      height: values.height,
      rotation: values.rotation,
    });
  }, [commit, commitNodeTransform, project]);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const point = toCompositionPoint(event.clientX, event.clientY);
      if (!point) return;

      if (mode !== "idle") {
        updatePointer(point, {
          shift: event.shiftKey,
          alt: event.altKey,
          meta: event.metaKey,
          ctrl: event.ctrlKey,
        });
        return;
      }

      if (!snapshot) return;
      const hits = resolveStageHit(snapshot, point);
      setHoverKey(hits.primary?.key ?? null);
    },
    [mode, snapshot, toCompositionPoint, updatePointer],
  );

  const onPointerUp = useCallback(() => {
    if (mode !== "idle") {
      finishGesture();
    }
  }, [finishGesture, mode]);

  useEffect(() => {
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerUp]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (selection.kind !== "node" || !project) return;
      const nodeBase = resolveNodeBase(selection.layerId);
      if (!nodeBase) return;
      const resolved = resolvePreviewProject(project);
      if (resolved.usingDemo) {
        const { lanes, clips } = visualTracksToTimelineClips(resolved.project);
        useEditorStore.setState({
          project: resolved.project,
          timelineLanes: lanes,
          timelineClips: clips,
        });
      }
      commitNodeTransform(nodeBase.rootLayerId, nodeBase.layerId, {
        x: nodeBase.x + dx,
        y: nodeBase.y + dy,
      });
    },
    [selection, project, resolveNodeBase, commitNodeTransform],
  );

  useStageHotkeys({
    isGestureActive: () => mode !== "idle",
    onCancelGesture: cancel,
    onNudge: nudge,
  });

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (usePlaybackClock.getState().mode === "playing") {
        usePlaybackClock.getState().pause();
        return;
      }
      if (!snapshot) return;
      const point = toCompositionPoint(event.clientX, event.clientY);
      if (!point) return;

      const handle = (event.target as HTMLElement).dataset.handle;
      if (handle && selectedItem) {
        event.preventDefault();
        event.stopPropagation();
        const nodeBase = resolveNodeBase(selectedItem.layerId);
        if (!nodeBase) return;
        if (handle === "rotate") {
          startRotate(nodeBase, selectedItem.worldBounds, point);
        } else {
          startResize(
            nodeBase,
            selectedItem.worldBounds,
            handle as ResizeHandle,
            point,
          );
        }
        return;
      }

      event.preventDefault();
      const hits = resolveStageHit(snapshot, point, {
        respectSelectable: false,
      }).items;
      if (hits.length === 0) {
        useEditorStore.setState({ selection: selectionNone() });
        setCycleIndex(0);
        return;
      }

      const nextIndex =
        event.altKey || event.detail > 1 ? (cycleIndex + 1) % hits.length : 0;
      setCycleIndex(nextIndex);
      const hit = hits[nextIndex];
      useEditorStore.setState({
        selection: selectionNode(hit.layerId),
      });

      const nodeBase = resolveNodeBase(hit.layerId);
      if (
        nodeBase &&
        !isElementLocked(envelope, nodeBase.rootLayerId, hit.layerId)
      ) {
        startMove(nodeBase, hit.worldBounds, point);
      }
    },
    [
      snapshot,
      toCompositionPoint,
      selectedItem,
      resolveNodeBase,
      startMove,
      startResize,
      startRotate,
      cycleIndex,
      envelope,
    ],
  );

  return (
    <div
      ref={rootRef}
      data-testid="interaction-overlay"
      className="absolute inset-0 z-[2] cursor-default"
      style={{ touchAction: "none" }}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerLeave={() => {
        if (mode === "idle") setHoverKey(null);
      }}
    >
      {hoverItem && hoverItem.key !== selectedItem?.key ? (
        <div
          data-testid="hover-bounds"
          style={{
            position: "absolute",
            ...percentBox(
              hoverItem.worldBounds.x,
              hoverItem.worldBounds.y,
              hoverItem.worldBounds.width,
              hoverItem.worldBounds.height,
              compositionWidth,
              compositionHeight,
            ),
            border: "1px dashed var(--accent-text)",
            pointerEvents: "none",
            boxSizing: "border-box",
          }}
        />
      ) : null}
      {selectedItem && previewBox ? (
        <div
          data-testid="selection-bounds"
          style={{
            position: "absolute",
            ...percentBox(
              previewBox.x,
              previewBox.y,
              previewBox.width,
              previewBox.height,
              compositionWidth,
              compositionHeight,
            ),
            border: "1.5px solid var(--accent)",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
            pointerEvents: "none",
            boxSizing: "border-box",
          }}
        >
          {HANDLES.map((handle) => {
            const pos: Record<string, string> = {};
            if (handle.includes("n")) pos.top = "-4px";
            if (handle.includes("s")) pos.bottom = "-4px";
            if (handle.includes("w")) pos.left = "-4px";
            if (handle.includes("e")) pos.right = "-4px";
            if (handle === "n" || handle === "s") {
              pos.left = "calc(50% - 4px)";
            }
            if (handle === "e" || handle === "w") {
              pos.top = "calc(50% - 4px)";
            }
            return (
              <button
                key={handle}
                type="button"
                data-handle={handle}
                data-testid={`resize-handle-${handle}`}
                aria-label={`Resize ${handle}`}
                className="absolute h-2 w-2 cursor-pointer border border-[var(--bg-site)] bg-[var(--accent)] p-0"
                style={{ ...pos, pointerEvents: "auto" }}
              />
            );
          })}
          <button
            type="button"
            data-handle="rotate"
            data-testid="rotate-handle"
            aria-label="Rotate"
            className="absolute left-[calc(50%-4px)] h-2 w-2 cursor-pointer rounded-full border border-[var(--bg-site)] bg-[var(--accent-text)] p-0"
            style={{ top: "-18px", pointerEvents: "auto" }}
          />
        </div>
      ) : null}
    </div>
  );
}
