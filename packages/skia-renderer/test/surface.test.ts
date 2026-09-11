import { afterEach, describe, expect, it } from "vitest";
import type { SkiaCanvasKit, SkiaSurface } from "../src/canvas-kit";
import { createSkiaSurface } from "../src/surface";

class FakeCanvas {}

function surface(): SkiaSurface {
  return { getCanvas: () => { throw new Error("not used"); }, flush() {}, dispose() {} };
}

function kit(overrides: Partial<SkiaCanvasKit>): SkiaCanvasKit {
  return { MakeSurface: () => surface(), ...overrides } as SkiaCanvasKit;
}

describe("CanvasKit presentation surface selection", () => {
  const previousCanvas = (globalThis as Record<string, unknown>).HTMLCanvasElement;

  afterEach(() => {
    if (previousCanvas === undefined) delete (globalThis as Record<string, unknown>).HTMLCanvasElement;
    else (globalThis as Record<string, unknown>).HTMLCanvasElement = previousCanvas;
  });

  it("selects a canvas-bound surface for live presentation", () => {
    (globalThis as Record<string, unknown>).HTMLCanvasElement = FakeCanvas;
    const canvas = new FakeCanvas() as unknown as HTMLCanvasElement;
    const direct = surface();
    let colorSpace: unknown;
    let fallbackCalls = 0;
    const selected = createSkiaSurface(kit({
      ColorSpace: { SRGB: "srgb" },
      MakeWebGLCanvasSurface: (_canvas, selectedColorSpace) => { colorSpace = selectedColorSpace; return direct; },
      MakeSurface: () => { fallbackCalls += 1; return surface(); },
    }), canvas, 1920, 1080, true);

    expect(selected.surface).toBe(direct);
    expect(selected.directPresentation).toBe(true);
    expect(colorSpace).toBe("srgb");
    expect(fallbackCalls).toBe(0);
  });

  it("falls back to readback when direct surface creation is unavailable", () => {
    (globalThis as Record<string, unknown>).HTMLCanvasElement = FakeCanvas;
    const canvas = new FakeCanvas() as unknown as HTMLCanvasElement;
    let fallbackCalls = 0;
    const selected = createSkiaSurface(kit({
      MakeWebGLCanvasSurface: () => { throw new Error("WebGL unavailable"); },
      MakeCanvasSurface: () => null,
      MakeSurface: () => { fallbackCalls += 1; return surface(); },
    }), canvas, 1920, 1080, true);

    expect(selected.surface).not.toBeNull();
    expect(selected.directPresentation).toBe(false);
    expect(fallbackCalls).toBe(1);
  });

  it("keeps the deterministic readback path when direct presentation is not requested", () => {
    (globalThis as Record<string, unknown>).HTMLCanvasElement = FakeCanvas;
    const canvas = new FakeCanvas() as unknown as HTMLCanvasElement;
    let directCalls = 0;
    const selected = createSkiaSurface(kit({
      MakeWebGLCanvasSurface: () => { directCalls += 1; return surface(); },
    }), canvas, 1920, 1080, false);

    expect(selected.directPresentation).toBe(false);
    expect(directCalls).toBe(0);
  });
});
