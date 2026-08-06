/**
 * Timeline hotkeys — controlled; apps inject ownership, undo/redo, and mode.
 */

import { useEffect } from "react";
import type { TimelineCommand } from "@motionvideo/editor-core";

export type UseTimelineHotkeysArgs = {
  enabled: boolean;
  isTimelineOwned: () => boolean;
  /** When true, skip split/delete (layer mode). */
  isLayerMode?: () => boolean;
  getPlayheadTime: () => number;
  onUndo: () => void;
  onRedo: () => void;
  onCommand: (command: TimelineCommand, label: string) => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onToggleAutoSnapping?: () => void;
  /** Escape while in layer mode. */
  onExitLayerMode?: () => void;
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
  isLayerMode,
  getPlayheadTime,
  onUndo,
  onRedo,
  onCommand,
  onCopy,
  onCut,
  onPaste,
  onZoomIn,
  onZoomOut,
  onToggleAutoSnapping,
  onExitLayerMode,
}: UseTimelineHotkeysArgs): void {
  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (isTypingTarget(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      const owned = isTimelineOwned();
      const layer = isLayerMode?.() ?? false;

      if (event.key === "Escape") {
        if (layer) {
          event.preventDefault();
          onExitLayerMode?.();
        }
        return;
      }

      if (!mod && !event.altKey && event.key.toLowerCase() === "n") {
        if (!owned) return;
        event.preventDefault();
        onToggleAutoSnapping?.();
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

      if (
        mod &&
        (event.key === "-" || event.key === "_" || event.code === "NumpadSubtract")
      ) {
        event.preventDefault();
        onZoomOut?.();
        return;
      }
      if (
        mod &&
        (event.key === "=" || event.key === "+" || event.code === "NumpadAdd")
      ) {
        event.preventDefault();
        onZoomIn?.();
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
        if (layer) return;
        event.preventDefault();
        onCommand(
          { type: "split-selected-clips", time: getPlayheadTime() },
          "Split clips",
        );
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (layer) return;
        event.preventDefault();
        onCommand({ type: "delete-selected-clips" }, "Delete clips");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    enabled,
    getPlayheadTime,
    isLayerMode,
    isTimelineOwned,
    onCommand,
    onCopy,
    onCut,
    onExitLayerMode,
    onPaste,
    onRedo,
    onToggleAutoSnapping,
    onUndo,
    onZoomIn,
    onZoomOut,
  ]);
}
