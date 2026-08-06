/**
 * Desktop adapter — wires UI session + snap prefs into controlled hotkeys.
 */

import {
  useTimelineHotkeys as useTimelineHotkeysShared,
} from "@motionvideo/editor-react";
import type { TimelineCommand } from "@motionvideo/editor-core";
import { useEditorUiSession } from "../../session/editor-ui-session";
import { useTimelineInteractionPrefs } from "../timeline-interaction-prefs";

type Args = {
  enabled: boolean;
  isTimelineOwned: () => boolean;
  getPlayheadTime: () => number;
  onUndo: () => void;
  onRedo: () => void;
  onExecute: (command: TimelineCommand, label: string) => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
};

export function useTimelineHotkeys({
  enabled,
  isTimelineOwned,
  getPlayheadTime,
  onUndo,
  onRedo,
  onExecute,
  onCopy,
  onCut,
  onPaste,
  onZoomIn,
  onZoomOut,
}: Args): void {
  const toggleAutoSnapping = useTimelineInteractionPrefs(
    (s) => s.toggleAutoSnapping,
  );

  useTimelineHotkeysShared({
    enabled,
    isTimelineOwned,
    isLayerMode: () => useEditorUiSession.getState().timelineMode === "layer",
    getPlayheadTime,
    onUndo,
    onRedo,
    onCommand: onExecute,
    onCopy,
    onCut,
    onPaste,
    onZoomIn:
      onZoomIn ??
      (() => {
        const s = useEditorUiSession.getState();
        s.setZoom(s.timelineZoom + 8);
      }),
    onZoomOut:
      onZoomOut ??
      (() => {
        const s = useEditorUiSession.getState();
        s.setZoom(s.timelineZoom - 8);
      }),
    onToggleAutoSnapping: toggleAutoSnapping,
    onExitLayerMode: () => useEditorUiSession.getState().exitLayerMode(),
  });
}
