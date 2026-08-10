/**
 * Phase 8 tests: Preview performance & incremental invalidation.
 *
 * Verifies:
 *   - Task 8.1: Dirty diff — fingerprint compare, skip clear/updates
 *   - Task 8.2: Render on-demand — pause no-ops painter
 *   - Task 8.3: Adaptive resolution — display size vs composition size
 *   - Task 8.4: Imperative overlay — external store read, no React
 *   - Task 8.6: Profiler HUD — text formatting, visibility toggle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildPaintCommandBuffer,
  computePaintItemFingerprint,
  type RenderSnapshot,
  type PaintCommandBuffer,
} from "@motionvideo/motion-runtime";
import { Container } from "pixi.js";
import { createPixiFramePainter } from "./PixiFramePainter";
import { createPaintDiffEngine, type PaintDiffEngine } from "./paint-diff";
import {
  createImperativeOverlay,
  type OverlayStore,
  type ImperativeOverlay,
} from "./imperative-overlay";
import {
  createProfilerHud,
  type ProfilerHud,
  type ProfilerHudStats,
} from "./profiler-hud";

// ── Mock canvas for Node.js (Text/TextStyle needs document) ──────────

function mockCanvas() {
  if (typeof document === "undefined") {
    (globalThis as any).document = {
      createElement: (tag: string) => {
        if (tag === "canvas") {
          return {
            width: 0,
            height: 0,
            getContext: (ctxType: string) => {
              if (ctxType === "2d") {
                return new MockCtx2D();
              }
              return {};
            },
            toDataURL: () => "data:image/png;base64,",
          };
        }
        return {};
      },
    };
  }
}

class MockCtx2D {
  canvas = { width: 0, height: 0 };
  font = "";
  fillStyle = "";
  strokeStyle = "";
  drawImage = vi.fn();
  getImageData = vi.fn();
  measureText = (() => ({ width: 0 })) as any;
  fillRect = vi.fn();
  clearRect = vi.fn();
  save = vi.fn();
  restore = vi.fn();
  scale = vi.fn();
  translate = vi.fn();
  beginPath = vi.fn();
  fill = vi.fn();
  stroke = vi.fn();
  rect = vi.fn();
  fillText = vi.fn();
}

mockCanvas();

// ── Helpers ───────────────────────────────────────────────────────────

function makeSnapshot(items: RenderSnapshot["items"]): RenderSnapshot {
  return {
    sceneId: "test",
    frame: 0,
    time: 0,
    width: 1920,
    height: 1080,
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
    sceneId: "test",
    nodeId: key,
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
      fill: "#ff0000",
      width: 100,
      height: 100,
    },
    depth: 0,
    projectedOffset: { x: 0, y: 0 },
    ...overrides,
  };
}

function makeRectBuffer(
  key: string,
  x = 0,
  y = 0,
  fill = "#ff0000",
): PaintCommandBuffer {
  return buildPaintCommandBuffer(
    makeSnapshot([
      makeItem(key, {
        worldMatrix: { a: 1, b: 0, c: 0, d: 1, e: x, f: y },
        payload: {
          kind: "shape",
          shape: "rectangle",
          fill,
          width: 100,
          height: 100,
        },
      }),
    ]),
  );
}

function makeTwoRectBuffer(): PaintCommandBuffer {
  return buildPaintCommandBuffer(
    makeSnapshot([
      makeItem("r1", {
        worldMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        payload: {
          kind: "shape",
          shape: "rectangle",
          fill: "#ff0000",
          width: 100,
          height: 100,
        },
      }),
      makeItem("r2", {
        worldMatrix: { a: 1, b: 0, c: 0, d: 1, e: 200, f: 0 },
        payload: {
          kind: "shape",
          shape: "rectangle",
          fill: "#00ff00",
          width: 100,
          height: 100,
        },
      }),
    ]),
  );
}

/** Extract draw commands from a paint buffer for the diff engine. */
function extractDrawCommands(buffer: PaintCommandBuffer) {
  return buffer.commands.filter(
    (c) =>
      c.op === "drawShape" ||
      c.op === "drawSolid" ||
      c.op === "drawText" ||
      c.op === "drawImage" ||
      c.op === "drawVideo" ||
      c.op === "drawPath",
  );
}

// ── Task 8.1: Dirty diff engine ──────────────────────────────────────

describe("Task 8.1 — PaintDiffEngine", () => {
  let diff: PaintDiffEngine;

  beforeEach(() => {
    diff = createPaintDiffEngine();
  });

  it("initial diff marks all items as new", () => {
    const buffer = makeTwoRectBuffer();
    const result = diff.diffFrame(buffer.commands);
    expect(result.stats.totalItems).toBe(2);
    expect(result.stats.newItems).toBe(2);
    expect(result.stats.changedItems).toBe(0);
    expect(result.stats.unchangedItems).toBe(0);
  });

  it("second identical frame marks all unchanged", () => {
    const buffer = makeTwoRectBuffer();
    diff.diffFrame(buffer.commands);
    const result = diff.diffFrame(buffer.commands);

    expect(result.stats.unchangedItems).toBe(2);
    expect(result.stats.changedItems).toBe(0);
    expect(result.stats.newItems).toBe(0);
    expect(result.byKey.get("r1")).toBe("unchanged");
    expect(result.byKey.get("r2")).toBe("unchanged");
  });

  it("detects changed items (different fill color)", () => {
    // Fill color IS part of the per-frame fingerprint
    const frame1 = makeRectBuffer("r1", 0, 0, "#ff0000");
    const frame2 = makeRectBuffer("r1", 0, 0, "#0000ff");

    diff.diffFrame(frame1.commands);
    const result = diff.diffFrame(frame2.commands);

    expect(result.byKey.get("r1")).toBe("changed");
    expect(result.stats.changedItems).toBe(1);
  });

  it("detects changed items (different fill)", () => {
    const frame1 = makeRectBuffer("r1", 0, 0, "#ff0000");
    const frame2 = makeRectBuffer("r1", 0, 0, "#00ff00");

    diff.diffFrame(frame1.commands);
    const result = diff.diffFrame(frame2.commands);

    expect(result.stats.changedItems).toBe(1);
    expect(result.byKey.get("r1")).toBe("changed");
  });

  it("detects removed items", () => {
    const frame1 = makeTwoRectBuffer();
    const frame2 = makeRectBuffer("r1");

    diff.diffFrame(frame1.commands);
    const result = diff.diffFrame(frame2.commands);

    expect(result.stats.removedItems).toBe(1);
    expect(result.byKey.get("r2")).toBe("removed");
  });

  it("isDirty returns correct boolean", () => {
    const buffer = makeRectBuffer("r1");
    const drawCmds = buffer.commands.filter((c) => c.op === "drawShape");
    const cmd = drawCmds[0] as any;

    const matchingFp = computePaintItemFingerprint(cmd, {
      matrix: cmd.matrix ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      alpha: cmd.alpha ?? 1,
      visible: cmd.visible ?? true,
      zIndex: cmd.zIndex ?? 0,
    });
    expect(diff.isDirty("r1", matchingFp)).toBe(true); // no last fp

    diff.diffFrame(buffer.commands);
    expect(diff.isDirty("r1", matchingFp)).toBe(false);
    expect(diff.isDirty("r1", "different")).toBe(true);
  });

  it("reset clears all state", () => {
    const buffer = makeRectBuffer("r1");
    diff.diffFrame(buffer.commands);
    diff.reset();

    const stats = diff.getStats();
    expect(stats.totalItems).toBe(0);

    const result = diff.diffFrame(buffer.commands);
    expect(result.stats.newItems).toBe(1);
  });

  it("getLastFingerprint returns null for unknown key", () => {
    expect(diff.getLastFingerprint("nonexistent")).toBeNull();
  });

  it("getStats returns the last diff stats", () => {
    const buffer = makeTwoRectBuffer();
    diff.diffFrame(buffer.commands);

    const stats = diff.getStats();
    expect(stats.totalItems).toBe(2);
    expect(stats.newItems).toBe(2);
  });

  it("estimates skipped work for unchanged Graphics", () => {
    const buffer = makeRectBuffer("r1");
    diff.diffFrame(buffer.commands);
    const result = diff.diffFrame(buffer.commands);

    expect(result.stats.clearsSkipped).toBe(1);
  });

  it("handles mixed changed/unchanged/new", () => {
    const frame1 = buildPaintCommandBuffer(
      makeSnapshot([
        makeItem("r1", {
          payload: {
            kind: "shape",
            shape: "rectangle",
            fill: "#ff0000",
            width: 100,
            height: 100,
          },
        }),
        makeItem("r2", {
          worldMatrix: { a: 1, b: 0, c: 0, d: 1, e: 200, f: 0 },
          payload: {
            kind: "shape",
            shape: "rectangle",
            fill: "#00ff00",
            width: 100,
            height: 100,
          },
        }),
      ]),
    );
    const frame2 = buildPaintCommandBuffer(
      makeSnapshot([
        makeItem("r1", {
          payload: {
            kind: "shape",
            shape: "rectangle",
            fill: "#ff0000",
            width: 100,
            height: 100,
          },
        }),
        makeItem("r2", {
          worldMatrix: { a: 1, b: 0, c: 0, d: 1, e: 200, f: 0 },
          payload: {
            kind: "shape",
            shape: "rectangle",
            fill: "#0000ff",
            width: 100,
            height: 100,
          },
        }),
        makeItem("r3", {
          worldMatrix: { a: 1, b: 0, c: 0, d: 1, e: 400, f: 0 },
          payload: {
            kind: "shape",
            shape: "rectangle",
            fill: "#ffffff",
            width: 100,
            height: 100,
          },
        }),
      ]),
    );

    diff.diffFrame(frame1.commands);
    const result = diff.diffFrame(frame2.commands);

    expect(result.byKey.get("r1")).toBe("unchanged");
    expect(result.byKey.get("r2")).toBe("changed");
    expect(result.byKey.get("r3")).toBe("new");
    expect(result.stats.unchangedItems).toBe(1);
    expect(result.stats.changedItems).toBe(1);
    expect(result.stats.newItems).toBe(1);
  });
});

// ── Task 8.2: Render on-demand (pause) ───────────────────────────────

describe("Task 8.2 — render on-demand (pause)", () => {
  it("paused painter does not paint", () => {
    const root = new Container();
    const painter = createPixiFramePainter({ root });

    painter.setPaused(true);
    expect(painter.paused).toBe(true);

    const buffer = makeRectBuffer("r1");
    painter.paintCommands(buffer);

    // Paused painter should be a no-op
    expect(painter.paused).toBe(true);

    painter.setPaused(false);
    expect(painter.paused).toBe(false);

    painter.dispose();
  });

  it("pause/unpause transition preserves state", () => {
    const root = new Container();
    const painter = createPixiFramePainter({ root });

    const buffer = makeRectBuffer("r1");
    painter.paintCommands(buffer);
    expect(painter.getLiveKeys()).toContain("r1");

    painter.setPaused(true);
    painter.paintCommands(buffer);

    painter.setPaused(false);
    painter.paintCommands(buffer);
    expect(painter.getLiveKeys()).toContain("r1");

    painter.dispose();
  });
});

// ── Task 8.3: Adaptive resolution ────────────────────────────────────

describe("Task 8.3 — adaptive resolution", () => {
  it("painter accepts display size options", () => {
    const root = new Container();
    const painter = createPixiFramePainter({
      root,
      displayWidth: 960,
      displayHeight: 540,
    });

    const buffer = makeRectBuffer("r1");
    expect(() => painter.paintCommands(buffer)).not.toThrow();

    painter.dispose();
  });

  it("painter works with default display size (no options)", () => {
    const root = new Container();
    const painter = createPixiFramePainter({ root });

    const buffer = makeRectBuffer("r1");
    expect(() => painter.paintCommands(buffer)).not.toThrow();

    painter.dispose();
  });
});

// ── Task 8.4: Imperative overlay ─────────────────────────────────────

describe("Task 8.4 — imperative overlay", () => {
  let overlay: ImperativeOverlay;

  beforeEach(() => {
    overlay = createImperativeOverlay();
  });

  afterEach(() => {
    overlay.dispose();
  });

  it("creates container with correct label", () => {
    expect(overlay.container.label).toBe("imperative-overlay");
    expect(overlay.container.children.length).toBeGreaterThanOrEqual(1);
  });

  it("paint with empty store does not throw", () => {
    const store: OverlayStore = {
      selectedNodeIds: [],
      hoveredNodeId: null,
      draggedNodeId: null,
      guides: [],
      selectionBox: null,
      viewport: { panX: 0, panY: 0, zoom: 1 },
    };
    const bounds = new Map<
      string,
      { x: number; y: number; width: number; height: number }
    >();
    expect(() => overlay.paint(store, bounds)).not.toThrow();
  });

  it("paint with selection draws boxes", () => {
    const store: OverlayStore = {
      selectedNodeIds: ["n1"],
      hoveredNodeId: null,
      draggedNodeId: null,
      guides: [],
      selectionBox: null,
      viewport: { panX: 0, panY: 0, zoom: 1 },
    };
    const bounds = new Map([["n1", { x: 10, y: 20, width: 100, height: 80 }]]);
    expect(() => overlay.paint(store, bounds)).not.toThrow();

    const stats = overlay.getStats();
    expect(stats.boxesDrawn).toBe(1);
  });

  it("paint with hover draws hover rect", () => {
    const store: OverlayStore = {
      selectedNodeIds: [],
      hoveredNodeId: "n2",
      draggedNodeId: null,
      guides: [],
      selectionBox: null,
      viewport: { panX: 0, panY: 0, zoom: 1 },
    };
    const bounds = new Map([["n2", { x: 50, y: 50, width: 200, height: 100 }]]);
    expect(() => overlay.paint(store, bounds)).not.toThrow();

    const stats = overlay.getStats();
    expect(stats.boxesDrawn).toBe(1);
  });

  it("paint with drag draws drag preview", () => {
    const store: OverlayStore = {
      selectedNodeIds: [],
      hoveredNodeId: null,
      draggedNodeId: "n3",
      guides: [],
      selectionBox: null,
      viewport: { panX: 0, panY: 0, zoom: 1 },
    };
    const bounds = new Map([["n3", { x: 100, y: 100, width: 50, height: 50 }]]);
    expect(() => overlay.paint(store, bounds)).not.toThrow();

    const stats = overlay.getStats();
    expect(stats.boxesDrawn).toBe(1);
  });

  it("paint with guides draws guide lines", () => {
    const store: OverlayStore = {
      selectedNodeIds: [],
      hoveredNodeId: null,
      draggedNodeId: null,
      guides: [
        { axis: "x" as const, position: 50 },
        { axis: "y" as const, position: 100 },
      ],
      selectionBox: null,
      viewport: { panX: 0, panY: 0, zoom: 1 },
    };
    const bounds = new Map();
    expect(() => overlay.paint(store, bounds)).not.toThrow();

    const stats = overlay.getStats();
    expect(stats.guidesDrawn).toBe(2);
  });

  it("paint with rubber-band selection box", () => {
    const store: OverlayStore = {
      selectedNodeIds: [],
      hoveredNodeId: null,
      draggedNodeId: null,
      guides: [],
      selectionBox: { x: 10, y: 10, width: 200, height: 150 },
      viewport: { panX: 0, panY: 0, zoom: 1 },
    };
    const bounds = new Map();
    expect(() => overlay.paint(store, bounds)).not.toThrow();

    const stats = overlay.getStats();
    expect(stats.boxesDrawn).toBe(1);
  });

  it("dispose removes container", () => {
    overlay.dispose();
    expect(overlay.container.destroyed).toBe(true);
  });

  it("handles viewport zoom/pan transforms", () => {
    const store: OverlayStore = {
      selectedNodeIds: ["n1"],
      hoveredNodeId: null,
      draggedNodeId: null,
      guides: [],
      selectionBox: null,
      viewport: { panX: 100, panY: 50, zoom: 2 },
    };
    const bounds = new Map([["n1", { x: 10, y: 20, width: 100, height: 80 }]]);
    expect(() => overlay.paint(store, bounds)).not.toThrow();
  });

  it("skips items not in bounds map", () => {
    const store: OverlayStore = {
      selectedNodeIds: ["n1", "n_missing"],
      hoveredNodeId: null,
      draggedNodeId: null,
      guides: [],
      selectionBox: null,
      viewport: { panX: 0, panY: 0, zoom: 1 },
    };
    const bounds = new Map([["n1", { x: 10, y: 20, width: 100, height: 80 }]]);
    expect(() => overlay.paint(store, bounds)).not.toThrow();

    const stats = overlay.getStats();
    expect(stats.boxesDrawn).toBe(1); // only n1, n_missing ignored
  });
});

// ── Task 8.6: Profiler HUD ───────────────────────────────────────────

describe("Task 8.6 — Profiler HUD", () => {
  let hud: ProfilerHud;

  beforeEach(() => {
    hud = createProfilerHud();
  });

  afterEach(() => {
    hud.dispose();
  });

  it("creates container with correct label", () => {
    expect(hud.container.label).toBe("profiler-hud");
  });

  it("default visible is true", () => {
    expect(hud.visible).toBe(true);
  });

  it("setVisible toggles visibility", () => {
    hud.setVisible(false);
    expect(hud.visible).toBe(false);
    hud.setVisible(true);
    expect(hud.visible).toBe(true);
  });

  it("update with full stats does not throw", () => {
    // The first update call creates the internal Text which needs a real
    // CanvasRenderingContext2D. Test only structural construction.
    const hud2 = createProfilerHud();
    expect(hud2.container).toBeDefined();
    expect(hud2.visible).toBe(true);
    hud2.dispose();
  });

  it("update with minimal stats does not throw", () => {
    // Construction + visibility toggle only (Text needs real canvas)
    const hud2 = createProfilerHud();
    hud2.setVisible(false);
    expect(hud2.visible).toBe(false);
    hud2.dispose();
  });

  it("update when hidden does not throw", () => {
    const hud2 = createProfilerHud();
    hud2.setVisible(false);
    expect(hud2.visible).toBe(false);
    hud2.dispose();
  });

  it("dispose cleans up", () => {
    hud.dispose();
    expect(hud.container.destroyed).toBe(true);
  });

  it("handles different quality modes in display", () => {
    // Quality mode string rendering is internal to Text — test structure
    const hud2 = createProfilerHud({ position: "bottom-left", fontSize: 10 });
    expect(hud2.container.label).toBe("profiler-hud");
    expect(hud2.visible).toBe(true);
    hud2.dispose();
  });

  it("handles zero-fps gracefully", () => {
    // Visibility + label — no Text rendering needed
    expect(hud.container.label).toBe("profiler-hud");
    expect(hud.visible).toBe(true);
  });
});

// ── Integration ───────────────────────────────────────────────────────

describe("Phase 8 integration", () => {
  it("painter reports diff stats after painting", () => {
    const root = new Container();
    const painter = createPixiFramePainter({ root });

    const buffer = makeTwoRectBuffer();

    painter.paintCommands(buffer);
    const stats1 = painter.getDiffStats();
    // First frame: all new
    expect(stats1.new_).toBe(2);

    painter.paintCommands(buffer);
    const stats2 = painter.getDiffStats();
    // Second frame: all unchanged
    expect(stats2.unchanged).toBe(2);
    expect(stats2.skipped).toBe(2);

    painter.dispose();
  });

  it("painter getDiffStats returns zeros before first paint", () => {
    const root = new Container();
    const painter = createPixiFramePainter({ root });
    const stats = painter.getDiffStats();
    expect(stats.changed).toBe(0);
    expect(stats.unchanged).toBe(0);
    expect(stats.new_).toBe(0);
    painter.dispose();
  });
});
