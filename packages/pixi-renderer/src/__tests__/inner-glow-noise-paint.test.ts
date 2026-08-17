import { describe, expect, it, vi } from "vitest";
import { Container, Graphics, RenderTexture } from "pixi.js";
import { createCompositingContext } from "../pixi-compositing";

function mockCanvas() {
  if (typeof document === "undefined") {
    (globalThis as unknown as { document: unknown }).document = {
      createElement: (tag: string) => {
        if (tag === "canvas") {
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              drawImage: vi.fn(),
              getImageData: vi.fn(),
            }),
            toDataURL: () => "data:image/png;base64,",
          };
        }
        return {};
      },
    };
  }
}

mockCanvas();

describe("Pixi offscreen flush", () => {
  it("renders offscreen child containers into the proxy RenderTexture", () => {
    const render = vi.fn();
    const root = new Container({ sortableChildren: true });
    const ctx = createCompositingContext({
      root,
      width: 400,
      height: 240,
      renderer: { render },
    });
    const parent = ctx.pushLayer({
      key: "hud-card",
      offscreen: true,
      isolation: true,
    });
    const child = new Graphics();
    child.rect(0, 0, 40, 40).fill(0xffffff);
    parent.addChild(child);
    ctx.popLayer("hud-card");
    ctx.endFrame();

    const layer = ctx.getLayers().get("hud-card");
    expect(layer?.offscreen).toBeDefined();
    expect(render).toHaveBeenCalledTimes(1);
    expect(render.mock.calls[0]![0]).toMatchObject({
      container: layer!.offscreen!.container,
      target: layer!.offscreen!.renderTexture,
      clear: true,
    });
    expect(layer!.offscreen!.renderTexture).toBeInstanceOf(RenderTexture);
    ctx.dispose();
  });
});
