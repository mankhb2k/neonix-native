import type { PlaybackOperationTokenV3 } from "./types";

export function createOperationRegistry() {
  let generation = 0;
  let operationId = 0;
  return {
    begin(kind: PlaybackOperationTokenV3["kind"]): PlaybackOperationTokenV3 { return { generation, operationId: ++operationId, kind }; },
    invalidate(): void { generation += 1; },
    current(token: PlaybackOperationTokenV3) { return token.generation === generation && token.operationId === operationId; },
    generation: () => generation,
  };
}

export function createResourceDisposalGuard() {
  let disposed = false;
  const disposers = new Set<() => void>();
  return {
    register(dispose: () => void) { if (disposed) dispose(); else disposers.add(dispose); return () => disposers.delete(dispose); },
    dispose() { if (disposed) return; disposed = true; for (const dispose of disposers) dispose(); disposers.clear(); },
    isDisposed: () => disposed,
  };
}

export type { PlaybackOperationTokenV3 } from "./types";
