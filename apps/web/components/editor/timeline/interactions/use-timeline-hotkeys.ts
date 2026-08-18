/**
 * Web adapter — wires Zustand editor store into controlled hotkeys.
 */

import { useTimelineHotkeys as useTimelineHotkeysShared } from "@/hooks/editor/timeline/use-timeline-hotkeys";
import type { TimelineCommand } from "@motionvideo/editor-core";
import { useEditorStore } from "@/lib/editor/editor-store";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";

type Args = {
  enabled: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  isLayerMode?: () => boolean;
  onExitLayerMode?: () => void;
};

export function useTimelineHotkeys({
  enabled,
  zoom,
  onZoomChange,
  isLayerMode,
  onExitLayerMode,
}: Args): void {
  const onUndo = useEditorStore((s) => s.undo);
  const onRedo = useEditorStore((s) => s.redo);

  useTimelineHotkeysShared({
    enabled,
    isTimelineOwned: () => true,
    isLayerMode,
    onExitLayerMode,
    getPlayheadTime: () => usePlaybackClock.getState().currentTime,
    onUndo,
    onRedo,
    onCommand: (command: TimelineCommand, label: string) => {
      void label;
      useEditorStore.getState().executeTimelineCommand(command);
    },
    onCopy: () => {
      useEditorStore.getState().copySelectedClips();
    },
    onCut: () => {
      useEditorStore.getState().cutSelectedClips();
    },
    onPaste: () => {
      useEditorStore
        .getState()
        .pasteClips(usePlaybackClock.getState().currentTime);
    },
    onZoomIn: () => {
      onZoomChange(zoom + 8);
    },
    onZoomOut: () => {
      onZoomChange(zoom - 8);
    },
  });
}
