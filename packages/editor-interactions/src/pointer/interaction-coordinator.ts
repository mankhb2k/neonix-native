export type InteractionCoordinator = {
  tryAcquire(token: string): boolean;
  release(token: string): void;
  reset(): void;
  readonly activeToken: string | null;
};

/** Coordinator theo từng instance editor — không dùng singleton toàn process cho quyền sở hữu. */
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
 * Default dùng cho migration: cho các app vẫn tạo controller mà không truyền
 * coordinator tường minh. Nên dùng `createInteractionCoordinator()` cho từng editor.
 */
export const defaultInteractionCoordinator = createInteractionCoordinator();
