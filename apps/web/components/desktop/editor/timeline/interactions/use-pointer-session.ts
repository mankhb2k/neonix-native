"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  PointerSessionController,
  type PointerPos,
  type PointerSessionConfig,
} from "@/lib/editor/timeline/sessions/pointer-session-controller";
import {
  shouldCommitPointerSession,
  type PointerSessionEndReason,
} from "@/lib/editor/pointer-session";

export type UsePointerSessionOptions<TState, TResult> = PointerSessionConfig<
  TState,
  TResult
> & {
  /** Extra commit gate — return false to cancel instead. */
  shouldCommit?: (state: TState) => boolean;
};

export type PointerSessionHandle<TState, TResult> = {
  /** Start session + bind window listeners + optional pointer capture. */
  begin: (args: {
    target: Element;
    pointerId: number;
    pos: PointerPos;
  }) => boolean;
  /** Push a pointer position (RAF-coalesced by controller). */
  update: (pos: PointerPos) => void;
  /** End with reason — pointerup commits; cancel/Escape rollback. */
  end: (reason: PointerSessionEndReason, pointerId?: number) => TResult | null;
  cancel: () => void;
  isRunning: () => boolean;
  token: () => string | null;
  getState: () => TState | null;
  /** Active pointer id, if any. */
  pointerId: () => number | null;
};

/**
 * DOM host for PointerSessionController.
 * Owns capture + window listeners; controller stays pure (no DOM in lib/).
 */
export function usePointerSession<TState, TResult = void>(
  options: UsePointerSessionOptions<TState, TResult>,
): PointerSessionHandle<TState, TResult> {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const controllerRef = useRef<PointerSessionController<TState, TResult> | null>(
    null,
  );
  const pointerIdRef = useRef<number | null>(null);
  const captureTargetRef = useRef<Element | null>(null);
  const listenersBoundRef = useRef(false);

  const unbindListenersRef = useRef<() => void>(() => undefined);

  const disposeBindings = useCallback(() => {
    unbindListenersRef.current();
    unbindListenersRef.current = () => undefined;
    listenersBoundRef.current = false;
    const target = captureTargetRef.current;
    const pid = pointerIdRef.current;
    if (target && pid != null) {
      try {
        target.releasePointerCapture(pid);
      } catch {
        /* already released */
      }
    }
    captureTargetRef.current = null;
    pointerIdRef.current = null;
  }, []);

  const ensureController = useCallback(() => {
    const opts = optionsRef.current;
    const controller = new PointerSessionController<TState, TResult>({
      name: opts.name,
      onStart: opts.onStart,
      onUpdate: opts.onUpdate,
      onCommit: opts.onCommit,
      onCancel: opts.onCancel,
    });
    controllerRef.current = controller;
    return controller;
  }, []);

  const cancelActive = useCallback(() => {
    const controller = controllerRef.current;
    if (controller?.isRunning) {
      controller.cancel();
    }
    disposeBindings();
    controllerRef.current = null;
  }, [disposeBindings]);

  const end = useCallback(
    (reason: PointerSessionEndReason, pointerId?: number): TResult | null => {
      const controller = controllerRef.current;
      if (!controller?.isRunning) {
        disposeBindings();
        return null;
      }
      if (pointerId != null && pointerIdRef.current !== pointerId) {
        return null;
      }

      controller.flushPendingUpdate();

      let result: TResult | null = null;
      if (shouldCommitPointerSession(reason)) {
        const state = controller.currentSessionState;
        const gate = optionsRef.current.shouldCommit;
        if (state && gate && !gate(state)) {
          controller.cancel();
        } else {
          result = controller.commit();
        }
      } else {
        controller.cancel();
      }
      disposeBindings();
      controllerRef.current = null;
      return result;
    },
    [disposeBindings],
  );

  const begin = useCallback(
    (args: {
      target: Element;
      pointerId: number;
      pos: PointerPos;
    }): boolean => {
      // Replace any prior session from this host.
      if (controllerRef.current?.isRunning) {
        cancelActive();
      }

      const controller = ensureController();
      const started = controller.start(args.pos);
      if (!started) {
        controllerRef.current = null;
        return false;
      }

      pointerIdRef.current = args.pointerId;
      captureTargetRef.current = args.target;
      try {
        args.target.setPointerCapture(args.pointerId);
      } catch {
        /* some targets may not support capture */
      }

      const onMove = (event: PointerEvent) => {
        if (event.pointerId !== pointerIdRef.current) return;
        controller.update({ x: event.clientX, y: event.clientY });
      };
      const onUp = (event: PointerEvent) => {
        end("pointerup", event.pointerId);
      };
      const onCancel = (event: PointerEvent) => {
        end("pointercancel", event.pointerId);
      };
      const onLostCapture = (event: Event) => {
        const pe = event as PointerEvent;
        if (pe.pointerId !== pointerIdRef.current) return;
        end("pointercancel", pe.pointerId);
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          end("escape");
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKeyDown);
      args.target.addEventListener("lostpointercapture", onLostCapture);
      listenersBoundRef.current = true;

      unbindListenersRef.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKeyDown);
        args.target.removeEventListener("lostpointercapture", onLostCapture);
      };

      return true;
    },
    [cancelActive, end, ensureController],
  );

  const update = useCallback((pos: PointerPos) => {
    controllerRef.current?.update(pos);
  }, []);

  useEffect(() => {
    return () => {
      cancelActive();
    };
  }, [cancelActive]);

  return {
    begin,
    update,
    end,
    cancel: cancelActive,
    isRunning: () => controllerRef.current?.isRunning ?? false,
    token: () =>
      controllerRef.current?.isRunning
        ? controllerRef.current.token
        : null,
    getState: () => controllerRef.current?.currentSessionState ?? null,
    pointerId: () => pointerIdRef.current,
  };
}

/** Test helper: count window listeners of a given type (jsdom). */
export function countWindowListeners(
  type: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jsdom internals
  win: any = typeof window !== "undefined" ? window : null,
): number {
  if (!win || typeof win.getEventListeners !== "function") return -1;
  const list = win.getEventListeners(win)?.[type];
  return Array.isArray(list) ? list.length : 0;
}
