/**
 * Basic timeline hotkeys (Wave D + clipboard).
 */

import { useEffect } from "react";
import type { TimelineCommand } from "@motionvideo/editor-core";

type Args = {
  enabled: boolean;
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
  getPlayheadTime,
  onUndo,
  onRedo,
  onExecute,
  onCopy,
  onCut,
  onPaste,
}: Args): void {
  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;

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
    getPlayheadTime,
    onUndo,
    onRedo,
    onExecute,
    onCopy,
    onCut,
    onPaste,
  ]);
}
