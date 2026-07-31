/**
 * Reusable panel resize — RAF-coalesce size updates (Phase 8).
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type PanelResizeAxis = "x" | "x-inverted" | "y-inverted";

type UsePanelResizeArgs = {
  axis: PanelResizeAxis;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  onActiveChange?: (active: boolean) => void;
};

/**
 * Pointer-driven resize controller.
 * Chỉ gọi onChange tối đa một lần/frame để tránh re-render nóng.
 */
export function usePanelResize({
  axis,
  value,
  min,
  max,
  onChange,
  onActiveChange,
}: UsePanelResizeArgs) {
  const valueRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const flush = useCallback(() => {
    rafRef.current = null;
    const next = pendingRef.current;
    if (next == null) return;
    pendingRef.current = null;
    onChange(next);
  }, [onChange]);

  const schedule = useCallback(
    (next: number) => {
      pendingRef.current = next;
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      onActiveChange?.(true);
      const startPos = axis === "y-inverted" ? event.clientY : event.clientX;
      const startValue = valueRef.current;

      const onPointerMove = (moveEvent: PointerEvent) => {
        let delta: number;
        if (axis === "x") {
          delta = moveEvent.clientX - startPos;
        } else if (axis === "x-inverted") {
          delta = startPos - moveEvent.clientX;
        } else {
          delta = startPos - moveEvent.clientY;
        }
        const next = Math.min(max, Math.max(min, startValue + delta));
        schedule(next);
      };

      const onPointerUp = () => {
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (pendingRef.current != null) {
          onChange(pendingRef.current);
          pendingRef.current = null;
        }
        onActiveChange?.(false);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [axis, max, min, onActiveChange, onChange, schedule],
  );

  return { onPointerDown };
}

/** Convenience state wrapper khi caller tự giữ value. */
export function usePanelSizeState(
  initial: number,
): [number, React.Dispatch<React.SetStateAction<number>>] {
  return useState(initial);
}
