/**
 * Phase 12 — Cancellation & lifecycle utilities.
 *
 * Provides a lightweight cancellation pattern using AbortSignal / AbortController
 * that threads through async compilation, frame evaluation, and worker operations.
 *
 * Design:
 *   - `isAborted(signal?)`: Check if an AbortSignal has been aborted.
 *   - `throwIfAborted(signal?)`: Throw a `CancellationError` if aborted.
 *   - `CancellationError`: Error class for cancelled operations.
 *   - `cancelledDiagnostic(code)`: Create a diagnostic record for cancellation events.
 *   - `withTimeout(ms, signal?)`: Combine a timeout with an existing signal.
 *
 * Usage in frame evaluation:
 * ```typescript
 * export function evaluateCompositionFrameV3(
 *   runtime, frame, fps, width, height, opts?: { signal?: AbortSignal }
 * ): EvaluatedCompositionFrame | null {
 *   throwIfAborted(opts?.signal);
 *   // ... evaluate ...
 *   for (const layer of layers) {
 *     throwIfAborted(opts?.signal); // check periodically
 *     // ...
 *   }
 * }
 * ```
 */

import { createDiagnostic, type RuntimeDiagnostic } from "./diagnostics";

// ── Error types ───────────────────────────────────────────────────────

/**
 * Thrown when an operation is cancelled via AbortSignal.
 */
export class CancellationError extends Error {
  readonly code: "EVALUATION_CANCELLED" | "COMPILE_CANCELLED" | "RENDER_CANCELLED" | "EXPORT_CANCELLED";

  constructor(
    code: "EVALUATION_CANCELLED" | "COMPILE_CANCELLED" | "RENDER_CANCELLED" | "EXPORT_CANCELLED",
    message?: string,
  ) {
    super(message ?? `Operation cancelled: ${code}`);
    this.name = "CancellationError";
    this.code = code;
  }
}

// ── Signal utilities ─────────────────────────────────────────────────

/**
 * Check if a signal has been aborted. Returns false if no signal provided.
 */
export function isAborted(signal?: AbortSignal | null): boolean {
  return signal?.aborted ?? false;
}

/**
 * Throw a CancellationError if the signal has been aborted.
 * Safe to call with undefined/null signal.
 */
export function throwIfAborted(
  signal?: AbortSignal | null,
  code: "EVALUATION_CANCELLED" | "COMPILE_CANCELLED" | "RENDER_CANCELLED" | "EXPORT_CANCELLED" = "EVALUATION_CANCELLED",
): void {
  if (isAborted(signal)) {
    throw new CancellationError(code, signal?.reason?.message ?? undefined);
  }
}

/**
 * Create a diagnostic record for a cancellation event.
 */
export function cancelledDiagnostic(
  code: "EVALUATION_CANCELLED" | "COMPILE_CANCELLED" | "RENDER_CANCELLED" | "EXPORT_CANCELLED",
  opts?: {
    frame?: number;
    time?: number;
    sceneId?: string;
  },
): RuntimeDiagnostic {
  return createDiagnostic(code, {
    message: `Operation cancelled: ${code}`,
    severity: "info",
    ...opts,
  });
}

/**
 * Combine an existing signal with a timeout.
 * Returns a new AbortSignal that fires when either the original signal
 * or the timeout expires.
 */
export function withTimeout(
  ms: number,
  signal?: AbortSignal | null,
): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Timeout")), ms);

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        controller.abort(signal.reason);
      },
      { once: true },
    );
  }

  return controller.signal;
}

// ── Disposable pattern (for synchronous cleanup) ─────────────────────

/**
 * Minimal Disposable interface matching the TC39 proposal.
 * Used by objects that need explicit cleanup.
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Async disposable for resources requiring async cleanup.
 */
export interface AsyncDisposable {
  dispose(): Promise<void>;
}

/**
 * Run a callback and ensure cleanup via dispose(), even on error or abort.
 *
 * ```typescript
 * await usingDispose(someResource, async (res) => {
 *   await res.doWork();
 * });
 * ```
 */
export async function usingDispose<T extends Disposable>(
  resource: T,
  fn: (resource: T) => Promise<void> | void,
): Promise<void> {
  try {
    await fn(resource);
  } finally {
    resource.dispose();
  }
}

// ── Re-exports ────────────────────────────────────────────────────────

export { type RuntimeDiagnostic };
