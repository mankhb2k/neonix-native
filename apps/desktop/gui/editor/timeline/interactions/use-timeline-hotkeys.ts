/**
 * Basic timeline hotkeys (Wave D + clipboard + auto-snap N).
 * Clipboard / delete / split / snap require timeline ownership so Stage/Sidebar
 * interactions are not stolen.
 */

import { useEffect } from "react";
import type { TimelineCommand } from "@motionvideo/editor-core";
import { useEditorUiSession } from "../../session/editor-ui-session";
import { useTimelineInteractionPrefs } from "../timeline-interaction-prefs";

type Args = {
  enabled: boolean;
  /** True while the timeline shell last received pointer ownership. */
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

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

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

  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (isTypingTarget(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      if (event.key === "Escape") {
        const session = useEditorUiSession.getState();
        if (session.timelineMode === "layer") {
          event.preventDefault();
          session.exitLayerMode();
          return;
        }
      }

      if (!mod && !event.altKey && event.key.toLowerCase() === "n") {
        if (!owned) return;
        event.preventDefault();
        toggleAutoSnapping();
        return;
      }

      if (mod && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        onUndo();
        return;
      }
      if (
        (mod && event.key.toLowerCase() === "y") ||
        (mod && event.shiftKey && event.key.toLowerCase() === "z")
      ) {
        event.preventDefault();
        onRedo();
        return;
      }

      if (mod && (event.key === "-" || event.key === "_" || event.code === "NumpadSubtract")) {
        event.preventDefault();
        if (onZoomOut) {
          onZoomOut();
        } else {
          const s = useEditorUiSession.getState();
          s.setZoom(s.timelineZoom - 8);
        }
        return;
      }
      if (mod && (event.key === "=" || event.key === "+" || event.code === "NumpadAdd")) {
        event.preventDefault();
        if (onZoomIn) {
          onZoomIn();
        } else {
          const s = useEditorUiSession.getState();
          s.setZoom(s.timelineZoom + 8);
        }
        return;
      }

      if (!owned) return;

      if (mod && event.key.toLowerCase() === "c") {
        event.preventDefault();
        onCopy?.();
        return;
      }
      if (mod && event.key.toLowerCase() === "x") {
        event.preventDefault();
        onCut?.();
        return;
      }
      if (mod && event.key.toLowerCase() === "v") {
        event.preventDefault();
        onPaste?.();
        return;
      }
      if (mod && event.key.toLowerCase() === "b") {
        event.preventDefault();
        onExecute(
          { type: "split-selected-clips", time: getPlayheadTime() },
          "Split clips",
        );
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        onExecute({ type: "delete-selected-clips" }, "Delete clips");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
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
    toggleAutoSnapping,
  ]);
}
