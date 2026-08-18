"use client";

import { usePlaybackDriver } from "@/hooks/editor/use-playback-driver";
import { useEditorStore } from "@/lib/editor/editor-store";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import type {
  EditorSelection,
  TimelineClip,
  TimelineCommand,
} from "@motionvideo/editor-core";
import {
  groupPathToTimelineClips,
  resolveGroupPath,
} from "@motionvideo/editor-core";
import { useCallback, useMemo, useState } from "react";
import { TransportBar } from "./Header/TransportBar";
import { TIMELINE_ZOOM_DEFAULT } from "./timeline-scale";
import { TimelineViewport } from "./viewport/TimelineViewport";
import { useTimelineHotkeys } from "./interactions/use-timeline-hotkeys";
import { compositionFps } from "@/lib/runtime/project-composition";

/**
 * CapCut/Canva-style timeline shell.
 * Main (`groupPath = []`) shows packed root clips from the store.
 * Inside a group, the surface is derived 1-child-1-row from `project.layers`.
 */
export function TimelineShell() {
  usePlaybackDriver();

  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const storeClips = useEditorStore((s) => s.timelineClips);
  const storeLanes = useEditorStore((s) => s.timelineLanes);
  const project = useEditorStore((s) => s.project);
  const groupPath = useEditorStore((s) => s.groupPath);
  const selection = useEditorStore((s) => s.selection);
  const setSelectedClipIds = useEditorStore((s) => s.setSelectedClipIds);
  const clearTimelineSelection = useEditorStore(
    (s) => s.clearTimelineSelection,
  );
  const selectNode = useEditorStore((s) => s.selectNode);
  const enterGroup = useEditorStore((s) => s.enterGroup);
  const navigateGroupDepth = useEditorStore((s) => s.navigateGroupDepth);

  const currentTime = usePlaybackClock((s) => s.currentTime);
  const clockDuration = usePlaybackClock((s) => s.duration);
  const mode = usePlaybackClock((s) => s.mode);
  const togglePlayback = usePlaybackClock((s) => s.togglePlayback);
  const seek = usePlaybackClock((s) => s.seek);
  const beginScrub = usePlaybackClock((s) => s.beginScrub);
  const endScrub = usePlaybackClock((s) => s.endScrub);

  const [zoom, setZoom] = useState(TIMELINE_ZOOM_DEFAULT);
  const [snapOn, setSnapOn] = useState(true);

  const inGroup = groupPath.length > 0;
  const groupSurface = useMemo(() => {
    if (!project || !inGroup) return null;
    return groupPathToTimelineClips(project, groupPath);
  }, [project, groupPath, inGroup]);

  const crumbs = useMemo(() => {
    if (!project || !inGroup) return [];
    return resolveGroupPath(project.layers, groupPath).crumbs;
  }, [project, groupPath, inGroup]);

  const clips = groupSurface?.clips ?? storeClips;
  const lanes = groupSurface?.lanes ?? storeLanes;
  const groupName = crumbs.at(-1)?.name ?? crumbs.at(-1)?.id ?? "";

  const fps = project ? compositionFps(project) : 30;
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
        selectNode(next.layerId);
        return;
      }
      clearTimelineSelection();
    },
    [clearTimelineSelection, selectNode, setSelectedClipIds],
  );

  useTimelineHotkeys({
    enabled: true,
    zoom,
    onZoomChange: setZoom,
    isLayerMode: () => useEditorStore.getState().groupPath.length > 0,
    onExitLayerMode: () =>
      useEditorStore.getState().navigateGroupDepth(0),
  });

  const onExecute = useCallback((command: TimelineCommand, _label: string) => {
    useEditorStore.getState().executeTimelineCommand(command);
  }, []);

  const onClipDoubleClick = useCallback(
    (clip: TimelineClip) => {
      if (clip.kind !== "scene") return;
      enterGroup(clip.sceneId);
    },
    [enterGroup],
  );

  return (
    <div
      className="editor-panel flex h-full min-h-0 flex-col overflow-hidden [grid-area:timeline]"
      data-testid="editor-timeline"
      data-timeline-scope={inGroup ? "group" : "main"}
    >
      <TransportBar
        mode={inGroup ? "layer" : "track"}
        onModeChange={(next) => {
          if (next === "track") {
            navigateGroupDepth(Math.max(0, groupPath.length - 1));
          }
        }}
        layerClipName={groupName}
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
        mode={inGroup ? "layer" : "track"}
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
        onClipDoubleClick={onClipDoubleClick}
      />
    </div>
  );
}
