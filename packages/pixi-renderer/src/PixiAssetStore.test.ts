import { describe, expect, it, vi } from "vitest";
import { Texture } from "pixi.js";
import { createPixiAssetStore } from "./PixiAssetStore";

describe("PixiAssetStore", () => {
  it("dedupes in-flight loads and ignores stale callbacks", async () => {
    const resolvers: Array<(t: Texture) => void> = [];
    const load = vi.fn(
      () =>
        new Promise<Texture>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const store = createPixiAssetStore({ load });
    const ready = vi.fn();

    const p1 = store.load("a.png", ready);
    const p2 = store.load("a.png", ready);
    expect(load).toHaveBeenCalledTimes(1);
    expect(resolvers).toHaveLength(1);

    store.invalidate();
    resolvers[0]!(Texture.WHITE);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(ready).not.toHaveBeenCalled();
    store.dispose();
  });

  it("caches successful loads", async () => {
    const tex = Texture.WHITE;
    const store = createPixiAssetStore({
      load: async () => tex,
    });
    const a = await store.load("x.png");
    const b = await store.load("x.png");
    expect(a).toBe(tex);
    expect(b).toBe(tex);
    expect(store.get("x.png")).toBe(tex);
    expect(
      await (async () => {
        const calls = vi.fn(async () => tex);
        const s2 = createPixiAssetStore({ load: calls });
        await s2.load("y.png");
        await s2.load("y.png");
        s2.dispose();
        return calls.mock.calls.length;
      })(),
    ).toBe(1);
    store.dispose();
  });
});
