"use client";

import { useState } from "react";
import { usePlaybackDriver } from "@/hooks/editor/use-playback-driver";
import { useEditorStore } from "@/lib/editor/editor-store";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import {
  DESIGN_LAYER_BOARD,
  DESIGN_TRACK_BOARD,
} from "./fixtures/design-board";
import {
  TransportBar,
  type TimelineDesignMode,
} from "./Header/TransportBar";
import { TIMELINE_ZOOM_DEFAULT } from "./timeline-scale";
import { TimelineViewport } from "./viewport/TimelineViewport";

/**
 * Design-only CapCut-style timeline board (Track / Layer chrome).
 * Interaction logic (move/trim/marquee/real layer session) deferred to phase 2.
 */
export function TimelineShell() {
  usePlaybackDriver();

  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);

  const currentTime = usePlaybackClock((s) => s.currentTime);
  const clockDuration = usePlaybackClock((s) => s.duration);
  const mode = usePlaybackClock((s) => s.mode);
  const togglePlayback = usePlaybackClock((s) => s.togglePlayback);

  const [designMode, setDesignMode] = useState<TimelineDesignMode>("track");
  const [zoom, setZoom] = useState(TIMELINE_ZOOM_DEFAULT);
  const [snapOn, setSnapOn] = useState(true);

  const board =
    designMode === "layer" ? DESIGN_LAYER_BOARD : DESIGN_TRACK_BOARD;
  const duration = Math.max(board.duration, clockDuration || 0);

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
        fps={board.fps}
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
        board={{ ...board, duration }}
        zoom={zoom}
        currentTime={currentTime}
      />
    </div>
  );
}
