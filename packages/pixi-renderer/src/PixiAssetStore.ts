/**
 * PixiAssetStore — deduped texture loads with generation/stale guards + dispose.
 */

import { Assets, Texture } from "pixi.js";

export type PixiAssetStoreOptions = {
  /** Optional loader override (tests). */
  load?: (uri: string) => Promise<Texture>;
};

export type PixiAssetStore = {
  get(uri: string): Texture | null;
  /** Load or reuse in-flight promise. Invokes onReady only if generation still current. */
  load(uri: string, onReady?: (uri: string, texture: Texture) => void): Promise<Texture | null>;
  /** Bump generation so in-flight loads become stale. */
  invalidate(): void;
  dispose(): void;
};

export function createPixiAssetStore(
  options: PixiAssetStoreOptions = {},
): PixiAssetStore {
  const textures = new Map<string, Texture>();
  const inflight = new Map<string, Promise<Texture | null>>();
  let generation = 0;
  const loadFn =
    options.load ??
    (async (uri: string) => (await Assets.load(uri)) as Texture);

  return {
    get(uri) {
      return textures.get(uri) ?? null;
    },

    async load(uri, onReady) {
      const cached = textures.get(uri);
      if (cached) {
        onReady?.(uri, cached);
        return cached;
      }

      const existing = inflight.get(uri);
      if (existing) {
        const tex = await existing;
        if (tex) onReady?.(uri, tex);
        return tex;
      }

      const gen = generation;
      const promise = loadFn(uri)
        .then((texture) => {
          if (gen !== generation) return null;
          textures.set(uri, texture);
          onReady?.(uri, texture);
          return texture;
        })
        .catch(() => null)
        .finally(() => {
          inflight.delete(uri);
        });

      inflight.set(uri, promise);
      return promise;
    },

    invalidate() {
      generation += 1;
      inflight.clear();
    },

    dispose() {
      generation += 1;
      inflight.clear();
      textures.clear();
    },
  };
}
