import type { PlaybackOperationTokenV3 } from "./types";

export function createOperationRegistry() {
  let generation = 0;
  let operationId = 0;
  let latestCommandId = 0;
  return {
    begin(kind: PlaybackOperationTokenV3["kind"]): PlaybackOperationTokenV3 {
      const id = ++operationId;
      // Render ticks must not invalidate an async transport command. Only a
      // new transport/load command supersedes the previous command.
      if (kind !== "tick") latestCommandId = id;
      return { generation, operationId: id, kind };
    },
    invalidate(): void { generation += 1; },
    current(token: PlaybackOperationTokenV3) {
      if (token.generation !== generation) return false;
      return token.kind === "tick" ? token.operationId === operationId : token.operationId === latestCommandId;
    },
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
