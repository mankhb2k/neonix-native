/**
 * Basic timeline hotkeys (Wave D + clipboard + auto-snap N).
 * Clipboard / delete / split / snap require timeline ownership so Stage/Sidebar
 * interactions are not stolen.
 */

import { useEffect } from "react";
import type { TimelineCommand } from "@motionvideo/editor-core";
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
      const owned = isTimelineOwned();

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
    toggleAutoSnapping,
  ]);
}
