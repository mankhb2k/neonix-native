"use client";

import {
  hitTestRenderSnapshot,
  type RenderSnapshot,
} from "@motionvideo/motion-runtime";
import {
  selectionNone,
  selectionNode,
} from "@/lib/editor/model/editor-selection";
import { useEditorStore } from "@/lib/editor/editor-store";
import { useStageInteractionStore } from "@/lib/editor/interaction/stage-interaction-store";
import { resolvePreviewProject } from "@/lib/editor/preview/preview-project";
import { sceneOrderToTimelineClips } from "@/lib/editor/timeline/scene-order-clips";
import { isElementLocked } from "@/lib/editor/authoring/web-project-envelope";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

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
  const mode = useStageInteractionStore((s) => s.mode);
  const preview = useStageInteractionStore((s) => s.preview);
  const base = useStageInteractionStore((s) => s.base);
  const beginMove = useStageInteractionStore((s) => s.beginMove);
  const beginResize = useStageInteractionStore((s) => s.beginResize);
  const beginRotate = useStageInteractionStore((s) => s.beginRotate);
  const updatePointer = useStageInteractionStore((s) => s.updatePointer);

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

  const previewBox = useMemo(() => {
    if (!selectedItem) return null;
    if (
      !preview ||
      !base ||
      preview.nodeId !== selectedItem.nodeId ||
      preview.sceneId !== selectedItem.sceneId
    ) {
      return selectedItem.worldBounds;
    }
    return {
      x: selectedItem.worldBounds.x + (preview.x - base.x),
      y: selectedItem.worldBounds.y + (preview.y - base.y),
      width: selectedItem.worldBounds.width + (preview.width - base.width),
      height: selectedItem.worldBounds.height + (preview.height - base.height),
    };
  }, [selectedItem, preview, base]);

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

  const resolveNodeBase = useCallback(
    (sceneId: string, nodeId: string) => {
      if (!project) return null;
      const previewProject = resolvePreviewProject(project).project;
      const scene = previewProject.scenes.find((s) => s.id === sceneId);
      const node = scene?.nodes.find((n) => n.id === nodeId);
      if (!node) return null;
      return {
        sceneId,
        nodeId,
        x: node.transform.x,
        y: node.transform.y,
        width: node.transform.width,
        height: node.transform.height,
        rotation: node.transform.rotation,
      };
    },
    [project],
  );

  const finishGesture = useCallback(() => {
    const committed = useStageInteractionStore.getState().takeCommit();
    if (!committed || !project) return;

    const resolved = resolvePreviewProject(project);
    if (resolved.usingDemo) {
      const { lanes, clips } = sceneOrderToTimelineClips(resolved.project);
      useEditorStore.setState({
        project: resolved.project,
        timelineLanes: lanes,
        timelineClips: clips,
      });
    }

    commitNodeTransform(committed.sceneId, committed.nodeId, {
      x: committed.x,
      y: committed.y,
      width: committed.width,
      height: committed.height,
      rotation: committed.rotation,
    });
  }, [commitNodeTransform, project]);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const point = toCompositionPoint(event.clientX, event.clientY);
      if (!point) return;

      if (useStageInteractionStore.getState().mode !== "idle") {
        updatePointer(point);
        return;
      }

      if (!snapshot) return;
      const hits = hitTestRenderSnapshot(snapshot, point);
      setHoverKey(hits[0]?.key ?? null);
    },
    [snapshot, toCompositionPoint, updatePointer],
  );

  const onPointerUp = useCallback(() => {
    if (useStageInteractionStore.getState().mode !== "idle") {
      finishGesture();
    }
  }, [finishGesture]);

  useEffect(() => {
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerUp]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        useStageInteractionStore.getState().cancel();
        return;
      }
      if (selection.kind !== "node" || !project) return;
      const step = event.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (event.key === "ArrowLeft") dx = -step;
      if (event.key === "ArrowRight") dx = step;
      if (event.key === "ArrowUp") dy = -step;
      if (event.key === "ArrowDown") dy = step;
      if (!dx && !dy) return;
      event.preventDefault();
      const nodeBase = resolveNodeBase(selection.sceneId, selection.nodeId);
      if (!nodeBase) return;
      const resolved = resolvePreviewProject(project);
      if (resolved.usingDemo) {
        const { lanes, clips } = sceneOrderToTimelineClips(resolved.project);
        useEditorStore.setState({
          project: resolved.project,
          timelineLanes: lanes,
          timelineClips: clips,
        });
      }
      commitNodeTransform(nodeBase.sceneId, nodeBase.nodeId, {
        x: nodeBase.x + dx,
        y: nodeBase.y + dy,
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, project, resolveNodeBase, commitNodeTransform]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (!snapshot) return;
      const point = toCompositionPoint(event.clientX, event.clientY);
      if (!point) return;

      const handle = (event.target as HTMLElement).dataset.handle;
      if (handle && selectedItem) {
        event.preventDefault();
        event.stopPropagation();
        const nodeBase = resolveNodeBase(
          selectedItem.sceneId,
          selectedItem.nodeId,
        );
        if (!nodeBase) return;
        if (handle === "rotate") {
          beginRotate(nodeBase, point);
        } else {
          beginResize(nodeBase, handle, point);
        }
        return;
      }

      event.preventDefault();
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

      const nodeBase = resolveNodeBase(hit.sceneId, hit.nodeId);
      if (
        nodeBase &&
        !isElementLocked(envelope, hit.sceneId, hit.nodeId)
      ) {
        beginMove(nodeBase, point);
      }
    },
    [
      snapshot,
      toCompositionPoint,
      selectedItem,
      resolveNodeBase,
      beginMove,
      beginResize,
      beginRotate,
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
                className="absolute h-2 w-2 cursor-pointer border border-[var(--bg-app)] bg-[var(--accent)] p-0"
                style={{ ...pos, pointerEvents: "auto" }}
              />
            );
          })}
          <button
            type="button"
            data-handle="rotate"
            data-testid="rotate-handle"
            aria-label="Rotate"
            className="absolute left-[calc(50%-4px)] h-2 w-2 cursor-pointer rounded-full border border-[var(--bg-app)] bg-[var(--accent-text)] p-0"
            style={{ top: "-18px", pointerEvents: "auto" }}
          />
        </div>
      ) : null}
    </div>
  );
}
