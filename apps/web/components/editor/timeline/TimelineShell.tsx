"use client";

import { usePlaybackDriver } from "@/hooks/editor/use-playback-driver";
import { useEditorStore } from "@/lib/editor/editor-store";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import type {
  EditorSelection,
  TimelineCommand,
} from "@motionvideo/editor-core";
import { useCallback, useState } from "react";
import { TransportBar, type TimelineDesignMode } from "./Header/TransportBar";
import { TIMELINE_ZOOM_DEFAULT } from "./timeline-scale";
import { TimelineViewport } from "./viewport/TimelineViewport";
import { useTimelineHotkeys } from "./interactions/use-timeline-hotkeys";

/**
 * CapCut/Canva-style timeline shell: store document, seek/zoom, select + marquee.
 * Move/trim deferred.
 */
export function TimelineShell() {
  usePlaybackDriver();

  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const clips = useEditorStore((s) => s.timelineClips);
  const lanes = useEditorStore((s) => s.timelineLanes);
  const project = useEditorStore((s) => s.project);
  const selection = useEditorStore((s) => s.selection);
  const setSelectedClipIds = useEditorStore((s) => s.setSelectedClipIds);
  const clearTimelineSelection = useEditorStore(
    (s) => s.clearTimelineSelection,
  );
  const selectNode = useEditorStore((s) => s.selectNode);

  const currentTime = usePlaybackClock((s) => s.currentTime);
  const clockDuration = usePlaybackClock((s) => s.duration);
  const mode = usePlaybackClock((s) => s.mode);
  const togglePlayback = usePlaybackClock((s) => s.togglePlayback);
  const seek = usePlaybackClock((s) => s.seek);
  const beginScrub = usePlaybackClock((s) => s.beginScrub);
  const endScrub = usePlaybackClock((s) => s.endScrub);

  const [designMode, setDesignMode] = useState<TimelineDesignMode>("track");
  const [zoom, setZoom] = useState(TIMELINE_ZOOM_DEFAULT);
  const [snapOn, setSnapOn] = useState(true);

  const fps = project?.metadata.fps ?? 30;
  const duration = Math.max(clockDuration || 0, 0);

  const onSelect = useCallback(
    (next: EditorSelection) => {
      if (next.kind === "none") {
        clearTimelineSelection();
        return;
      }
      if (next.kind === "clips") {
        setSelectedClipIds(next.ids);
        return;
      }
      if (next.kind === "node") {
        selectNode(next.nodeId);
        return;
      }
      clearTimelineSelection();
    },
    [clearTimelineSelection, selectNode, setSelectedClipIds],
  );

  useTimelineHotkeys({ enabled: true, zoom, onZoomChange: setZoom });

  const onExecute = useCallback((command: TimelineCommand, _label: string) => {
    useEditorStore.getState().executeTimelineCommand(command);
  }, []);

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[var(--bg-panel)]"
      data-testid="editor-timeline"
    >
      <TransportBar
        mode={designMode}
        onModeChange={setDesignMode}
        currentTime={currentTime}
        duration={duration}
        fps={fps}
        isPlaying={mode === "playing"}
        onTogglePlay={() => togglePlayback()}
        zoom={zoom}
        onZoomChange={setZoom}
        snapOn={snapOn}
        onToggleSnap={() => setSnapOn((v) => !v)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => undo()}
        onRedo={() => redo()}
      />
      <TimelineViewport
        mode={designMode}
        clips={clips}
        lanes={lanes}
        duration={duration}
        fps={fps}
        zoom={zoom}
        currentTime={currentTime}
        isPlaying={mode === "playing"}
        selection={selection}
        onSelect={onSelect}
        onSeek={seek}
        onExecute={onExecute}
        onBeginScrub={beginScrub}
        onEndScrub={endScrub}
      />
    </div>
  );
}
