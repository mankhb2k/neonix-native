export type InteractionCoordinator = {
  tryAcquire(token: string): boolean;
  release(token: string): void;
  reset(): void;
  readonly activeToken: string | null;
};

/** Per editor-instance coordinator — no process-wide singleton for ownership. */
export function createInteractionCoordinator(): InteractionCoordinator {
  let activeToken: string | null = null;
  return {
    get activeToken() {
      return activeToken;
    },
    tryAcquire(token: string): boolean {
      if (activeToken !== null) return false;
      activeToken = token;
      return true;
    },
    release(token: string): void {
      if (activeToken === token) activeToken = null;
    },
    reset(): void {
      activeToken = null;
    },
  };
}

/**
 * Migration default for apps that still construct controllers without an
 * explicit coordinator. Prefer `createInteractionCoordinator()` per editor.
 */
export const defaultInteractionCoordinator = createInteractionCoordinator();
