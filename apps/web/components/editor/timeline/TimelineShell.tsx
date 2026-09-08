"use client";

import { useMemo, useState } from "react";
import { useTimelineActions } from "@/hooks/editor/timeline/use-timeline-actions";
import { useTimelineCommandAdapter } from "@/hooks/editor/timeline/use-timeline-command-adapter";
import { useTimelinePlaybackPort } from "@/hooks/editor/timeline/use-timeline-playback-port";
import { useTimelineProjection } from "@/hooks/editor/timeline/use-timeline-projection";
import { useEditorDocument } from "@/hooks/editor/use-editor-store";
import {
  selectionClips as protocolSelectionClips,
  selectedClipIds as protocolSelectedClipIds,
} from "@motionvideo/editor-core";
import { TransportBar } from "./Header/TransportBar";
import { TIMELINE_ZOOM_DEFAULT } from "./timeline-scale";
import { TimelineViewport } from "./viewport/TimelineViewport";

/** Timeline chrome backed by the Protocol V2 document adapter. */
export function TimelineShell() {
  const playback = useTimelinePlaybackPort();
  const document = useEditorDocument();
  const {
    selectionToEditor,
    selectionFromLayers,
    canUndo,
    canRedo,
    canDelete,
    undo,
    redo,
    deleteSelectedLayers,
    onAction,
  } = useTimelineActions({ document });
  const [zoom, setZoom] = useState(TIMELINE_ZOOM_DEFAULT);
  const [snapOn, setSnapOn] = useState(true);
  const { projection, fitAnchorSeconds, fitRevision, fitTimeline } =
    useTimelineProjection({ document });
  const fps = document.composition.fps;
  // Playback owns the playable duration. The timeline projection may still
  // describe authored clip extents for layout, but it must not become a
  // second transport-duration source.
  const duration = Math.max(playback.duration, 0.001);
  const selection = selectionFromLayers;
  const onExecute = useTimelineCommandAdapter({
    document,
    projection,
  });
  const onFit = () => {
    fitTimeline();
    setZoom(TIMELINE_ZOOM_DEFAULT);
  };

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
        currentTime={playback.currentTime}
        duration={duration}
        fps={fps}
        isPlaying={playback.playing}
        onTogglePlay={playback.toggle}
        zoom={zoom}
        onZoomChange={setZoom}
        onFit={onFit}
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
        playback={playback}
        fps={fps}
        zoom={zoom}
        timelineFitAnchorSeconds={fitAnchorSeconds}
        fitRevision={fitRevision}
        selection={selection}
        onSelect={selectionToEditor}
        onExecute={onExecute}
        onAction={onAction}
        exclusiveRows
        autoSnapping={snapOn}
      />
    </section>
  );
}
