/**
 * Stage hotkeys — Escape cancels gesture; arrows nudge via callback.
 */

import { useEffect } from "react";

export type UseStageHotkeysArgs = {
  enabled?: boolean;
  isGestureActive: () => boolean;
  onCancelGesture: () => void;
  onNudge?: (dx: number, dy: number) => void;
};

export function useStageHotkeys({
  enabled = true,
  isGestureActive,
  onCancelGesture,
  onNudge,
}: UseStageHotkeysArgs): void {
  useEffect(() => {
    if (!enabled) return undefined;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isGestureActive()) {
          event.preventDefault();
          onCancelGesture();
        }
        return;
      }
      if (!onNudge || isGestureActive()) return;
      const step = event.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (event.key === "ArrowLeft") dx = -step;
      if (event.key === "ArrowRight") dx = step;
      if (event.key === "ArrowUp") dy = -step;
      if (event.key === "ArrowDown") dy = step;
      if (!dx && !dy) return;
      event.preventDefault();
      onNudge(dx, dy);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, isGestureActive, onCancelGesture, onNudge]);
}
