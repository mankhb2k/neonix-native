export type ScrubFlushReason = "begin" | "frame" | "end";

export type ScrubCoordinatorOptions = {
  requestFrame?: (callback: () => void) => number;
  cancelFrame?: (handle: number) => void;
  onBegin?: () => void;
  onFlush: (clientX: number, reason: ScrubFlushReason) => void;
  /** Scrolls the viewport while the pointer remains near an edge. */
  onEdgeFrame?: (clientX: number) => boolean;
  onEnd?: () => void;
};

export type ScrubCoordinator = {
  begin(clientX: number): void;
  move(clientX: number): void;
  end(): void;
  cancel(): void;
  readonly dragging: boolean;
};

function defaultRequestFrame(callback: () => void): number {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(callback);
  return setTimeout(callback, 16) as unknown as number;
}

function defaultCancelFrame(handle: number): void {
  if (typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(handle);
    return;
  }
  clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
}

/**
 * Coalesces high-frequency pointer moves into at most one seek per frame.
 * The coordinator is deliberately framework-agnostic so it can be tested
 * without rendering TimelineViewport or mounting React.
 */
export function createScrubCoordinator(
  options: ScrubCoordinatorOptions,
): ScrubCoordinator {
  const requestFrame = options.requestFrame ?? defaultRequestFrame;
  const cancelFrame = options.cancelFrame ?? defaultCancelFrame;
  let isDragging = false;
  let latestClientX = 0;
  let pending = false;
  let frameHandle: number | null = null;

  const schedule = () => {
    if (!isDragging || frameHandle != null) return;
    frameHandle = requestFrame(tick);
  };

  const stopFrame = () => {
    if (frameHandle == null) return;
    cancelFrame(frameHandle);
    frameHandle = null;
  };

  const tick = () => {
    frameHandle = null;
    if (!isDragging) return;
    const edgeScrolled = options.onEdgeFrame?.(latestClientX) ?? false;
    if (pending || edgeScrolled) {
      pending = false;
      options.onFlush(latestClientX, "frame");
    }
    if (isDragging && edgeScrolled) schedule();
  };

  return {
    begin(clientX) {
      if (isDragging) return;
      isDragging = true;
      latestClientX = clientX;
      pending = false;
      options.onBegin?.();
      options.onFlush(clientX, "begin");
      schedule();
    },
    move(clientX) {
      if (!isDragging) return;
      latestClientX = clientX;
      pending = true;
      schedule();
    },
    end() {
      if (!isDragging) return;
      isDragging = false;
      stopFrame();
      // Always flush the pointer-up position. This makes the final seek exact
      // even when pointerup arrives before the next RAF callback.
      pending = false;
      options.onFlush(latestClientX, "end");
      options.onEnd?.();
    },
    cancel() {
      isDragging = false;
      pending = false;
      stopFrame();
    },
    get dragging() {
      return isDragging;
    },
  };
}
