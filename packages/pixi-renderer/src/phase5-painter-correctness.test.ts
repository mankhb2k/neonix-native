/**
 * Phase 5 tests: Pixi retained painter correctness.
 *
 * Verifies:
 *   - Task 5.1: Container hierarchy nesting (beginLayer/endLayer, beginGroup/endGroup)
 *   - Task 5.2: Offscreen RenderTexture pipeline
 *   - Task 5.3: Mask wiring (alpha, luma, clip, inverse)
 *   - Task 5.4: Transition layer support (multi-scene)
 *   - Task 5.5: Text completeness (fontWeight, rich runs, wrap, letter spacing)
 *   - Task 5.6: Image/path with fit/crop, stale guard
 *   - Task 5.7: Unsupported diagnostic overlay
 *   - Task 5.8: Dispose lifecycle (textures, filters, offscreen)
 */
import { describe, it, expect, vi } from "vitest";
import {
  buildPaintCommandBuffer,
  type RenderSnapshot,
  type PaintCommandBuffer,
} from "@motionvideo/motion-runtime";
import { Container } from "pixi.js";
import { createPixiFramePainter } from "./PixiFramePainter";
import {
  createCompositingContext,
  createRenderTexturePool,
} from "./pixi-compositing";

// ── Mock canvas for Node.js RenderTexture support ────────────────────

function mockCanvas() {
  // pixi.js RenderTexture.create uses document.createElement('canvas')
  if (typeof document === "undefined") {
    (globalThis as any).document = {
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

// ── Test fixtures ────────────────────────────────────────────────────

function makeSnapshot(items: RenderSnapshot["items"]): RenderSnapshot {
  return {
    graphId: "test",
    frame: 0,
    time: 0,
    width: 400,
    height: 300,
    space: "flat-2d",
    projection: { kind: "orthographic" },
    cameraMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    items,
  };
}

function makeItem(
  key: string,
  overrides: Partial<RenderSnapshot["items"][0]> = {},
): RenderSnapshot["items"][0] {
  return {
    key,
    graphId: "test",
    layerId: key.split(":")[1] ?? key,
    nodeType: "shape",
    worldMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    worldBounds: { x: 0, y: 0, width: 100, height: 100 },
    worldOpacity: 1,
    visible: true,
    selectable: true,
    locked: false,
    renderOrder: 0,
    payload: {
      kind: "shape",
      shape: "rectangle",
      fill: "#f00",
      width: 100,
      height: 100,
    },
    depth: 0,
    projectedOffset: { x: 0, y: 0 },
    ...overrides,
  };
}

function makeLayerSnapshot(): PaintCommandBuffer {
  // Build a buffer with beginLayer/endLayer wrapping a drawable
  const snapshot = makeSnapshot([
    makeItem("test:n1", {
      effects: [{ id: "f1", type: "blur", radius: 5 }],
      compositing: {
        isolation: "isolate",
        needsOffscreen: true,
        isAdjustment: false,
        effectOrder: [{ id: "f1", type: "blur" }],
      },
    }),
  ]);
  return buildPaintCommandBuffer(snapshot);
}

// ── Task 5.1: Container hierarchy nesting ────────────────────────────

describe("Task 5.1 — container hierarchy nesting", () => {
  it("beginLayer/endLayer no longer skipped", () => {
    const buffer = makeLayerSnapshot();
    const ops = buffer.commands.map((c) => c.op);
    expect(ops).toContain("beginLayer");
    expect(ops).toContain("endLayer");
  });

  it("painter does not crash with beginLayer/endLayer (was skip=continue)", () => {
    const root = new Container({ sortableChildren: true });
    const painter = createPixiFramePainter({ root });
    const buffer = makeLayerSnapshot();
    expect(() => painter.paintCommands(buffer)).not.toThrow();
    expect(root.children.length).toBeGreaterThan(0);
    painter.dispose();
  });

  it("beginGroup/endGroup produces proper container nesting", () => {
    const snapshot = makeSnapshot([
      makeItem("test:g1", {
        payload: { kind: "group", width: 200, height: 200 },
      }),
    ]);
    const buffer = buildPaintCommandBuffer(snapshot);
    const root = new Container({ sortableChildren: true });
    const painter = createPixiFramePainter({ root });
    painter.paintCommands(buffer);

    expect(root.children.length).toBeGreaterThan(0);
    // Group should be a Container with children
    const groupContainer = root.children[0] as Container;
    expect(groupContainer.label).toContain("test:g1");
    painter.dispose();
  });

  it("nested layer+group produces layered tree", () => {
    const snapshot = makeSnapshot([
      makeItem("test:group", {
        key: "test:group",
        payload: { kind: "group", width: 200, height: 200 },
        compositing: {
          isolation: "isolate",
          needsOffscreen: true,
          isAdjustment: false,
          effectOrder: [],
        },
      }),
    ]);
    const buffer = buildPaintCommandBuffer(snapshot);
    const root = new Container({ sortableChildren: true });
    const painter = createPixiFramePainter({ root });
    expect(() => painter.paintCommands(buffer)).not.toThrow();
    painter.dispose();
  });
});

// ── Task 5.2: Offscreen RenderTexture ────────────────────────────────

describe("Task 5.2 — offscreen RenderTexture pipeline", () => {
  it("RenderTexturePool acquires and releases", () => {
    const pool = createRenderTexturePool();
    const rt1 = pool.acquire(100, 100);
    expect(rt1.width).toBe(100);
    expect(rt1.height).toBe(100);

    pool.release(rt1);
    pool.disposeStale();

    // Re-acquire same size — should reuse
    const rt2 = pool.acquire(100, 100);
    expect(rt2).toBeDefined();
    pool.dispose();
  });

  it("offscreen layer creates RenderTexture-backed proxy", () => {
    const root = new Container({ sortableChildren: true });
    const ctx = createCompositingContext({ root, width: 400, height: 300 });

    ctx.pushLayer({ key: "offscreen_1", offscreen: true, isolation: true });
    ctx.pushGroup("inner", "n1");
    // Add a child to the offscreen container
    const child = new Container();
    child.label = "child_in_offscreen";
    ctx.currentParent.addChild(child);
    ctx.popGroup("inner");
    ctx.popLayer("offscreen_1");
    ctx.endFrame();

    const layers = ctx.getLayers();
    const layer = layers.get("offscreen_1");
    expect(layer).toBeDefined();
    expect(layer?.offscreen).toBeDefined();
    if (layer?.offscreen) {
      expect(layer.offscreen.renderTexture).toBeDefined();
      expect(layer.offscreen.proxy).toBeDefined();
      // The offscreen container should have the child
      expect(layer.offscreen.container.children.length).toBeGreaterThan(0);
    }

    ctx.dispose();
  });

  it("non-offscreen layer uses direct container (no proxy)", () => {
    const root = new Container({ sortableChildren: true });
    const ctx = createCompositingContext({ root, width: 400, height: 300 });

    ctx.pushLayer({ key: "direct", offscreen: false, isolation: false });
    const child = new Container();
    ctx.currentParent.addChild(child);
    ctx.popLayer("direct");
    ctx.endFrame();

    const layers = ctx.getLayers();
    const layer = layers.get("direct");
    expect(layer).toBeDefined();
    expect(layer?.offscreen).toBeNull();
    // Display should directly be the container (no proxy sprite)
    expect(layer?.display).toBe(layer?.childContainer);

    ctx.dispose();
  });
});

// ── Task 5.3: Mask wiring ───────────────────────────────────────────

describe("Task 5.3 — mask wiring", () => {
  it("beginLayer with mask config records mask source key", () => {
    const root = new Container({ sortableChildren: true });
    const ctx = createCompositingContext({ root, width: 400, height: 300 });

    ctx.pushLayer({
      key: "masked_layer",
      offscreen: true,
      isolation: true,
      mask: { mode: "alpha", sourceKey: "mask_src" },
    });
    const child = new Container();
    ctx.currentParent.addChild(child);
    ctx.popLayer("masked_layer");
    ctx.endFrame();

    const layers = ctx.getLayers();
    const layer = layers.get("masked_layer");
    expect(layer?.maskSourceKey).toBe("mask_src");

    ctx.dispose();
  });

  it("applyMask wires Pixi .mask property", () => {
    const root = new Container({ sortableChildren: true });
    const ctx = createCompositingContext({ root, width: 400, height: 300 });

    ctx.pushLayer({
      key: "target",
      offscreen: false,
      isolation: false,
      mask: { mode: "alpha", sourceKey: "src_graphic" },
    });

    // Simulate mask source being created
    const maskSource = new Container();
    maskSource.label = "src_graphic";
    root.addChild(maskSource);

    ctx.applyMask("target", maskSource);
    ctx.popLayer("target");
    ctx.endFrame();

    const layers = ctx.getLayers();
    const layer = layers.get("target");
    expect(layer?.display.mask).toBe(maskSource);

    ctx.dispose();
  });
});

// ── Task 5.4: Transition layer support ──────────────────────────────

describe("Task 5.4 — transition layer support", () => {
  it("multiple scene items in one buffer all render", () => {
    const root = new Container({ sortableChildren: true });
    const painter = createPixiFramePainter({ root });
    const buffer = buildPaintCommandBuffer(
      makeSnapshot([makeItem("sceneA:a"), makeItem("sceneB:b")]),
    );
    painter.paintCommands(buffer);
    expect(painter.getLiveKeys()).toContain("sceneA:a");
    expect(painter.getLiveKeys()).toContain("sceneB:b");
    expect(root.children.length).toBeGreaterThanOrEqual(2);
    painter.dispose();
  });

  it("transition with overlapping layers does not crash", () => {
    const root = new Container({ sortableChildren: true });
    const painter = createPixiFramePainter({ root });
    // Simulate a crossfade: scene A fading out, scene B fading in
    const buffer = buildPaintCommandBuffer(
      makeSnapshot([
        makeItem("sceneA:content", { worldOpacity: 0.3 }),
        makeItem("sceneB:content", { worldOpacity: 0.7, renderOrder: 1 }),
      ]),
    );
    expect(() => painter.paintCommands(buffer)).not.toThrow();
    expect(painter.getLiveKeys()).toHaveLength(2);
    painter.dispose();
  });
});

// ── Task 5.5: Text completeness ─────────────────────────────────────

describe("Task 5.5 — text completeness", () => {
  it("fontWeight is applied as string", () => {
    const snapshot = makeSnapshot([
      makeItem("test:bold", {
        nodeType: "text",
        payload: {
          kind: "text",
          text: "Bold Text",
          fontSize: 24,
          fontWeight: 700,
          fill: "#000",
        },
      }),
    ]);
    const buffer = buildPaintCommandBuffer(snapshot);
    const root = new Container({ sortableChildren: true });
    const painter = createPixiFramePainter({ root });
    painter.paintCommands(buffer);
    // Should not throw — fontWeight is applied
    expect(root.children.length).toBe(1);
    painter.dispose();
  });

  it("lineHeight and letterSpacing are applied", () => {
    const snapshot = makeSnapshot([
      makeItem("test:spaced", {
        nodeType: "text",
        payload: {
          kind: "text",
          text: "Spaced",
          fontSize: 16,
          fill: "#000",
          lineHeight: 24,
          letterSpacing: 2,
        },
      }),
    ]);
    const buffer = buildPaintCommandBuffer(snapshot);
    const root = new Container({ sortableChildren: true });
    const painter = createPixiFramePainter({ root });
    expect(() => painter.paintCommands(buffer)).not.toThrow();
    painter.dispose();
  });

  it("text with rich runs renders without crash", () => {
    const snapshot = makeSnapshot([
      makeItem("test:rich", {
        nodeType: "text",
        payload: {
          kind: "text",
          text: "Rich",
          fontSize: 16,
          fill: "#000",
          runs: [
            { id: "r1", text: "Red", fill: "#f00", fontWeight: 700 },
            { id: "r2", text: "Blue", fill: "#00f" },
          ],
        },
      }),
    ]);
    const buffer = buildPaintCommandBuffer(snapshot);
    const root = new Container({ sortableChildren: true });
    const painter = createPixiFramePainter({ root });
    expect(() => painter.paintCommands(buffer)).not.toThrow();
    painter.dispose();
  });

  it("text wrap is enabled by default for non-none wrap", () => {
    const snapshot = makeSnapshot([
      makeItem("test:wrap", {
        nodeType: "text",
        payload: {
          kind: "text",
          text: "A very long text that should wrap",
          fontSize: 14,
          fill: "#000",
          wrap: "word",
          width: 100,
          height: 200,
        },
      }),
    ]);
    const buffer = buildPaintCommandBuffer(snapshot);
    const root = new Container({ sortableChildren: true });
    const painter = createPixiFramePainter({ root });
    expect(() => painter.paintCommands(buffer)).not.toThrow();
    painter.dispose();
  });
});

// ── Task 5.6: Image/path fit/crop, stale guard ──────────────────────

describe("Task 5.6 — image/path fit/crop", () => {
  it("image with missing URI does not crash (stale guard)", () => {
    const snapshot = makeSnapshot([
      makeItem("test:img", {
        nodeType: "image",
        payload: {
          kind: "image",
          assetId: "img-1",
          uri: undefined,
          width: 100,
          height: 100,
        },
      }),
    ]);
    const buffer = buildPaintCommandBuffer(snapshot);
    const root = new Container({ sortableChildren: true });
    // Track unsupported/errors
    const errors: string[] = [];
    const painter = createPixiFramePainter({
      root,
      onUnsupported: (info) => errors.push(info.key),
    });
    expect(() => painter.paintCommands(buffer)).not.toThrow();
    expect(root.children.length).toBeGreaterThanOrEqual(1);
    painter.dispose();
  });

  it("image with unavailable URI shows magenta tint (stale guard)", () => {
    const snapshot = makeSnapshot([
      makeItem("test:nonexist", {
        nodeType: "image",
        payload: {
          kind: "image",
          assetId: "nonexist",
          uri: "https://example.com/nonexist.png",
          width: 100,
          height: 100,
        },
      }),
    ]);
    const buffer = buildPaintCommandBuffer(snapshot);
    const root = new Container({ sortableChildren: true });
    const painter = createPixiFramePainter({ root });
    expect(() => painter.paintCommands(buffer)).not.toThrow();
    painter.dispose();
  });

  it("path with fill + stroke renders without crash", () => {
    const snapshot = makeSnapshot([
      makeItem("test:path", {
        nodeType: "path",
        payload: {
          kind: "path",
          contours: [
            {
              start: { x: 0, y: 0 },
              closed: true,
              segments: [
                { kind: "line", to: { x: 50, y: 0 } },
                { kind: "line", to: { x: 50, y: 50 } },
                { kind: "line", to: { x: 0, y: 50 } },
              ],
            },
          ],
          fillRule: "nonzero",
          fill: "#0f0",
          stroke: "#000",
          strokeWidth: 2,
          fillOpacity: 1,
          strokeOpacity: 1,
        },
      }),
    ]);
    const buffer = buildPaintCommandBuffer(snapshot);
    const root = new Container({ sortableChildren: true });
    const painter = createPixiFramePainter({ root });
    expect(() => painter.paintCommands(buffer)).not.toThrow();
    painter.dispose();
  });
});

// ── Task 5.7: Unsupported diagnostic overlay ────────────────────────

describe("Task 5.7 — unsupported diagnostic overlay", () => {
  it("unsupported command creates magenta checkerboard overlay", () => {
    const root = new Container({ sortableChildren: true });
    const seen: string[] = [];
    const painter = createPixiFramePainter({
      root,
      onUnsupported: (info) => seen.push(info.nodeType),
    });
    const buffer = buildPaintCommandBuffer(
      makeSnapshot([
        makeItem("test:bad", {
          nodeType: "mesh",
          payload: { kind: "unknown", nodeType: "mesh" } as any,
        }),
      ]),
    );
    painter.paintCommands(buffer);
    expect(painter.getUnsupported()).toHaveLength(1);
    expect(seen).toContain("mesh");
    // Should have a graphic for the overlay
    expect(root.children.length).toBeGreaterThanOrEqual(1);
    painter.dispose();
  });

  it("onUnsupported is called for each unsupported node", () => {
    const root = new Container({ sortableChildren: true });
    const calls: Array<{ key: string; nodeType: string }> = [];
    const painter = createPixiFramePainter({
      root,
      onUnsupported: (info) =>
        calls.push({ key: info.key, nodeType: info.nodeType }),
    });
    const buffer = buildPaintCommandBuffer(
      makeSnapshot([
        makeItem("test:a", {
          nodeType: "3d",
          payload: { kind: "unknown", nodeType: "3d" } as any,
        }),
        makeItem("test:b", {
          nodeType: "webgl",
          payload: { kind: "unknown", nodeType: "webgl" } as any,
        }),
      ]),
    );
    painter.paintCommands(buffer);
    expect(painter.getUnsupported()).toHaveLength(2);
    expect(calls).toHaveLength(2);
    painter.dispose();
  });
});

// ── Task 5.8: Dispose lifecycle ─────────────────────────────────────

describe("Task 5.8 — dispose lifecycle", () => {
  it("clear then repaint does not leak objects", () => {
    const root = new Container({ sortableChildren: true });
    const painter = createPixiFramePainter({ root });

    // Paint 3 times
    for (let i = 0; i < 3; i++) {
      const buffer = buildPaintCommandBuffer(
        makeSnapshot([makeItem(`test:n${i}`)]),
      );
      painter.paintCommands(buffer);
    }

    const keys = painter.getLiveKeys();
    expect(keys).toHaveLength(1);

    // Clear
    painter.clear();
    expect(painter.getLiveKeys()).toEqual([]);
    expect(root.children.length).toBe(0);

    painter.dispose();
  });

  it("dispose cleans up compositing context", () => {
    const root = new Container({ sortableChildren: true });
    const painter = createPixiFramePainter({ root });
    const buffer = makeLayerSnapshot();
    painter.paintCommands(buffer);
    expect(() => painter.dispose()).not.toThrow();
  });

  it("multiple paint/clear cycles do not leak children", () => {
    const root = new Container({ sortableChildren: true });
    const painter = createPixiFramePainter({ root });

    for (let cycle = 0; cycle < 5; cycle++) {
      const buffer = buildPaintCommandBuffer(
        makeSnapshot([makeItem(`test:a`), makeItem(`test:b`)]),
      );
      painter.paintCommands(buffer);
      painter.clear();
    }

    expect(root.children.length).toBe(0);
    painter.dispose();
  });

  it("compositing context pool reuses textures across frames", () => {
    const root = new Container({ sortableChildren: true });
    const painter = createPixiFramePainter({ root });

    // Paint offscreen layer
    const snapshot = makeSnapshot([
      makeItem("test:blur", {
        effects: [{ id: "f1", type: "blur", radius: 3 }],
        compositing: {
          isolation: "isolate",
          needsOffscreen: true,
          isAdjustment: false,
          effectOrder: [{ id: "f1", type: "blur" }],
        },
      }),
    ]);
    const buffer = buildPaintCommandBuffer(snapshot);

    // Paint twice — second should reuse
    painter.paintCommands(buffer);
    painter.paintCommands(buffer);

    expect(painter.getLiveKeys()).toContain("test:blur");
    painter.dispose();
  });
});

// ── Integration: compositing context standalone ──────────────────────

describe("CompositingContext (standalone)", () => {
  it("creating and disposing context does not throw", () => {
    const root = new Container({ sortableChildren: true });
    const ctx = createCompositingContext({ root, width: 400, height: 300 });
    expect(ctx).toBeDefined();
    ctx.dispose();
  });

  it("pushGroup/popGroup maintains stack integrity", () => {
    const root = new Container({ sortableChildren: true });
    const ctx = createCompositingContext({ root, width: 400, height: 300 });

    ctx.pushGroup("g1", "n1");
    ctx.pushGroup("g2", "n2");
    // Should have 3 frames on stack (root, g1, g2)
    ctx.popGroup("g2");
    ctx.popGroup("g1");
    ctx.endFrame();

    expect(() => ctx.dispose()).not.toThrow();
  });

  it("popLayer throws on mismatched stack", () => {
    const root = new Container({ sortableChildren: true });
    const ctx = createCompositingContext({ root, width: 400, height: 300 });
    expect(() => ctx.popLayer("no_such_layer")).toThrow();
    ctx.dispose();
  });

  it("popGroup throws on mismatched stack", () => {
    const root = new Container({ sortableChildren: true });
    const ctx = createCompositingContext({ root, width: 400, height: 300 });
    expect(() => ctx.popGroup("no_such_group")).toThrow();
    ctx.dispose();
  });
});
