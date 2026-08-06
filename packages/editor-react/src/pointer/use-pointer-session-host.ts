/**
 * React host for pointer sessions — one host per editor surface.
 * Unmount only cancels the gesture this host owns.
 */

import { useCallback, useEffect, useRef } from "react";
import {
  PointerSessionController,
  shouldCommitPointerSession,
  type InteractionCoordinator,
  type PointerPos,
  type PointerSessionConfig,
  type PointerSessionEndReason,
} from "@motionvideo/editor-interactions";

export type ActivePointerGesture = {
  controller: PointerSessionController<unknown>;
  dispose: () => void;
};

export type BeginGesture = <TState, TResult>(
  config: PointerSessionConfig<TState, TResult>,
  initialPos: PointerPos,
  bindTarget?: HTMLElement | null,
  pointerId?: number,
) => PointerSessionController<TState, TResult> | null;

export type UsePointerSessionHostOptions = {
  coordinator?: InteractionCoordinator;
};

export function usePointerSessionHost(
  options?: UsePointerSessionHostOptions,
) {
  const activeRef = useRef<ActivePointerGesture | null>(null);
  const coordinator = options?.coordinator;

  const clearActive = useCallback(
    (reason: PointerSessionEndReason = "pointercancel") => {
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
    },
    [],
  );

  useEffect(() => {
    return () => {
      clearActive("pointercancel");
    };
  }, [clearActive]);

  const beginGesture = useCallback(
    <TState, TResult>(
      config: PointerSessionConfig<TState, TResult>,
      initialPos: PointerPos,
      bindTarget?: HTMLElement | null,
      pointerId?: number,
    ): PointerSessionController<TState, TResult> | null => {
      clearActive("pointercancel");
      const controller = new PointerSessionController(config, {
        coordinator,
      });
      if (!controller.start(initialPos)) return null;

      const capturedPointerId = pointerId;
      const captureTarget = bindTarget ?? null;
      if (captureTarget != null && capturedPointerId != null) {
        try {
          captureTarget.setPointerCapture(capturedPointerId);
        } catch {
          /* some targets may not support capture */
        }
      }

      const releaseCapture = () => {
        if (captureTarget == null || capturedPointerId == null) return;
        try {
          captureTarget.releasePointerCapture(capturedPointerId);
        } catch {
          /* already released / unsupported */
        }
      };

      const onMove = (ev: PointerEvent) => {
        if (capturedPointerId != null && ev.pointerId !== capturedPointerId) {
          return;
        }
        controller.update({ x: ev.clientX, y: ev.clientY });
      };
      const finish = (reason: PointerSessionEndReason) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey);
        if (captureTarget) {
          captureTarget.removeEventListener(
            "lostpointercapture",
            onLostCapture,
          );
        } else {
          window.removeEventListener("lostpointercapture", onLostCapture);
        }
        releaseCapture();
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
      const onUp = (ev: PointerEvent) => {
        if (capturedPointerId != null && ev.pointerId !== capturedPointerId) {
          return;
        }
        finish("pointerup");
      };
      const onCancel = (ev: PointerEvent) => {
        if (capturedPointerId != null && ev.pointerId !== capturedPointerId) {
          return;
        }
        finish("pointercancel");
      };
      const onLostCapture = (ev: Event) => {
        const pe = ev as PointerEvent;
        if (capturedPointerId != null && pe.pointerId !== capturedPointerId) {
          return;
        }
        finish("pointercancel");
      };
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          finish("escape");
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey);
      if (captureTarget) {
        captureTarget.addEventListener("lostpointercapture", onLostCapture);
      } else {
        window.addEventListener("lostpointercapture", onLostCapture);
      }

      const dispose = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey);
        if (captureTarget) {
          captureTarget.removeEventListener(
            "lostpointercapture",
            onLostCapture,
          );
        } else {
          window.removeEventListener("lostpointercapture", onLostCapture);
        }
        releaseCapture();
      };

      activeRef.current = {
        controller: controller as unknown as PointerSessionController<unknown>,
        dispose,
      };

      return controller;
    },
    [clearActive, coordinator],
  );

  return { beginGesture, clearActive, activeRef };
}
