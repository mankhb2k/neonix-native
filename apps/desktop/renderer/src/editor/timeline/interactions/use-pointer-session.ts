/**
 * React host for pointer sessions — one host per TimelineViewport.
 * Unmount only cancels the gesture this host owns (never nukes a foreign token).
 */

import { useEffect, useRef } from "react";
import {
  shouldCommitPointerSession,
  type PointerSessionEndReason,
} from "./pointer-session";
import {
  PointerSessionController,
  type PointerPos,
  type PointerSessionConfig,
} from "./pointer-session-controller";

export type ActivePointerGesture = {
  controller: PointerSessionController<unknown>;
  dispose: () => void;
};

export type BeginGesture = <TState, TResult>(
  config: PointerSessionConfig<TState, TResult>,
  initialPos: PointerPos,
  bindTarget?: HTMLElement | null,
) => PointerSessionController<TState, TResult> | null;

/**
 * Owns the active gesture for a component tree (place once on TimelineViewport).
 */
export function usePointerSessionHost() {
  const activeRef = useRef<ActivePointerGesture | null>(null);

  const clearActive = (reason: PointerSessionEndReason = "pointercancel") => {
    const active = activeRef.current;
    if (!active) return;
    active.dispose();
    if (active.controller.isRunning) {
      if (shouldCommitPointerSession(reason)) {
        active.controller.flushPendingUpdate();
        active.controller.commit();
      } else {
        active.controller.cancel();
      }
    }
    activeRef.current = null;
  };

  useEffect(() => {
    return () => {
      // Only dispose this host's gesture — do not reset the global token
      // (another host must never clear a foreign active session).
      clearActive("pointercancel");
    };
  }, []);

  function beginGesture<TState, TResult>(
    config: PointerSessionConfig<TState, TResult>,
    initialPos: PointerPos,
    bindTarget?: HTMLElement | null,
  ): PointerSessionController<TState, TResult> | null {
    clearActive("pointercancel");
    const controller = new PointerSessionController(config);
    if (!controller.start(initialPos)) return null;

    const onMove = (ev: PointerEvent) => {
      controller.update({ x: ev.clientX, y: ev.clientY });
    };
    const finish = (reason: PointerSessionEndReason) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("lostpointercapture", onLostCapture);
      window.removeEventListener("keydown", onKey);
      if (
        activeRef.current?.controller ===
        (controller as unknown as PointerSessionController<unknown>)
      ) {
        activeRef.current = null;
      }
      controller.flushPendingUpdate();
      if (shouldCommitPointerSession(reason)) {
        controller.commit();
      } else if (controller.isRunning) {
        controller.cancel();
      }
    };
    const onUp = () => finish("pointerup");
    const onCancel = () => finish("pointercancel");
    const onLostCapture = () => finish("pointercancel");
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        finish("escape");
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("lostpointercapture", onLostCapture);
    window.addEventListener("keydown", onKey);

    const dispose = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("lostpointercapture", onLostCapture);
      window.removeEventListener("keydown", onKey);
    };

    activeRef.current = {
      controller: controller as unknown as PointerSessionController<unknown>,
      dispose,
    };

    void bindTarget;
    return controller;
  }

  return { beginGesture, clearActive, activeRef };
}
