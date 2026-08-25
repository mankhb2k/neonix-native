"use client";

import { useEditorSurface } from "@/components/editor/EditorSurfaceProvider";
import {
  projectLayersToTimeline,
} from "@motionvideo/editor-core/timeline";
import type { EditorCommand } from "@motionvideo/editor-core/document/commands";
import {
  selectionClips as protocolSelectionClips,
  selectedClipIds as protocolSelectedClipIds,
} from "@motionvideo/editor-core/selection";
import {
  selectedClipIdsFrom,
  selectionClips,
  selectionNone,
  resolveFitAnchorSeconds,
  type EditorSelection,
  type TimelineEdit,
  timelineEditToDocumentCommand,
} from "@motionvideo/editor-core/timeline";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TransportBar } from "./Header/TransportBar";
import { TimelineViewport } from "./viewport/TimelineViewport";
import { TIMELINE_ZOOM_DEFAULT } from "./timeline-scale";

/** Timeline chrome backed by the Protocol V2 document adapter. */
export function TimelineShell() {
  const {
    document,
    currentTime,
    isPlaying,
    setCurrentTime,
    setIsPlaying,
    selectedLayerIds,
    setSelectedLayerIds,
    applyCommand,
    undo,
    redo,
    deleteSelectedLayers,
    canUndo,
    canRedo,
    canDelete,
    lockedLayerIds,
  } = useEditorSurface();
  const [zoom, setZoom] = useState(TIMELINE_ZOOM_DEFAULT);
  const [snapOn, setSnapOn] = useState(true);

  const projection = useMemo(
    () => projectLayersToTimeline(document),
    [document],
  );
  // Fit is a session decision, not a side effect of projecting each layer.
  // New clips therefore map into the existing ruler without changing its scale.
  const [fitAnchorSeconds, setFitAnchorSeconds] = useState<number | null>(
    () => resolveFitAnchorSeconds(projection.clips),
  );
  const [fitRevision, setFitRevision] = useState(0);
  const fps = document.composition.fps;
  const duration = Math.max(projection.duration, 0.001);
  const selection = useMemo<EditorSelection>(
    () =>
      selectedLayerIds.length > 0
        ? selectionClips(selectedLayerIds)
        : selectionNone(),
    [selectedLayerIds],
  );

  useEffect(() => {
    if (!isPlaying) return undefined;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - previous) / 1000;
      previous = now;
      setCurrentTime((time) => {
        const next = time + elapsed;
        if (next >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, isPlaying, setCurrentTime, setIsPlaying]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;

      const commandKey = event.metaKey || event.ctrlKey;
      if (commandKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (commandKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!canDelete) return;
        event.preventDefault();
        deleteSelectedLayers();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canDelete, deleteSelectedLayers, redo, undo]);

  const onSelect = useCallback(
    (next: EditorSelection) => {
      setSelectedLayerIds(
        selectedClipIdsFrom(next).filter((id) => !lockedLayerIds.includes(id)),
      );
    },
    [lockedLayerIds, setSelectedLayerIds],
  );

  const onExecute = useCallback(
    (command: TimelineEdit, label: string) => {
      void label;
      const affectedClipIds =
        command.type === "move-clip" || command.type === "clip/trim"
          ? [command.clipId]
          : command.type === "move-clips"
            ? command.clipIds
            : command.type === "reorder-lane"
              ? projection.clips
                  .filter((clip) => clip.laneId === command.laneId)
                  .map((clip) => clip.id)
              : [];
      const affectedLayerIds = projection.clips
        .filter((clip) => affectedClipIds.includes(clip.id))
        .map((clip) => (clip.kind === "scene" ? clip.sceneId : null))
        .filter((id): id is string => Boolean(id));
      if (affectedLayerIds.some((id) => lockedLayerIds.includes(id))) return;
      const documentCommand: EditorCommand | null = timelineEditToDocumentCommand(
        document,
        projection,
        command,
      );
      if (documentCommand) applyCommand(documentCommand);
    },
    [applyCommand, document, lockedLayerIds, projection],
  );

  const fitTimeline = useCallback(() => {
    setFitAnchorSeconds(resolveFitAnchorSeconds(projection.clips));
    setZoom(TIMELINE_ZOOM_DEFAULT);
    setFitRevision((revision) => revision + 1);
  }, [projection.clips]);

  const selectedClipIds = useMemo(
    () => protocolSelectedClipIds(
      protocolSelectionClips(
        selection.kind === "clips" ? selection.ids : [],
        selection.kind === "clips" ? selection.primaryId : undefined,
      ),
    ),
    [selection],
  );

  return (
    <section
      className="editor-panel flex h-full min-h-0 flex-col overflow-hidden [grid-area:timeline]"
      data-testid="editor-timeline"
      data-timeline-source="v1-viewport-v2-document"
      data-selected-clip-count={selectedClipIds.length}
    >
      <TransportBar
        mode="track"
        onModeChange={() => undefined}
        currentTime={currentTime}
        duration={duration}
        fps={fps}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying((playing) => !playing)}
        zoom={zoom}
        onZoomChange={setZoom}
        onFit={fitTimeline}
        snapOn={snapOn}
        onToggleSnap={() => setSnapOn((value) => !value)}
        canUndo={canUndo}
        canRedo={canRedo}
        canDelete={canDelete}
        onUndo={undo}
        onRedo={redo}
        onDelete={deleteSelectedLayers}
      />
      <TimelineViewport
        mode="track"
        clips={projection.clips}
        lanes={projection.lanes}
        duration={duration}
        fps={fps}
        zoom={zoom}
        timelineFitAnchorSeconds={fitAnchorSeconds}
        fitRevision={fitRevision}
        currentTime={currentTime}
        isPlaying={isPlaying}
        selection={selection}
        onSelect={onSelect}
        onSeek={setCurrentTime}
        onExecute={onExecute}
        exclusiveRows
        autoSnapping={snapOn}
      />
    </section>
  );
}
