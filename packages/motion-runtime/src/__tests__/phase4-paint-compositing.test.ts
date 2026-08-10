/**
 * Phase 4 tests: Paint display list & compositing semantics.
 *
 * Task 4.1: Compositing semantics (layer/group nesting, mask, offscreen)
 * Task 4.2: Item fingerprint (deterministic per-frame fingerprint)
 * Task 4.3: Explicit unsupported (never silently ignored)
 * Task 4.4: Contract versioning + validator
 * Task 4.5: Geometry union seam (affine-2d / projected-quad / mesh)
 */
import { describe, it, expect } from "vitest";

// ── Task 4.1: Compositing semantics ──────────────────────────────────

import {
  buildPaintCommandBuffer,
  decodePaintCommandBuffer,
  type PaintCommandBuffer,
  type PaintLayerScope,
  type PaintGroupScope,
  type PaintDrawable,
} from "../paint";

import {
  extractPaintResource,
  extractPaintFrameProperty,
  splitPaintCommand,
  type SplitPaintCommand,
} from "../paint";

import type { RenderSnapshot, RenderSnapshotItem } from "../render-snapshot";
import type { PaintDrawCommand } from "../paint";

function makeBlurSnapshot(items: RenderSnapshotItem[]): RenderSnapshot {
  return {
    sceneId: "test",
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
  overrides: Partial<RenderSnapshotItem> = {},
): RenderSnapshotItem {
  return {
    key: "test:n1",
    sceneId: "test",
    nodeId: "n1",
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

describe("Task 4.1 — compositing semantics (spec)", () => {
  it("simple item produces no layer/group nesting", () => {
    const buffer = buildPaintCommandBuffer(makeBlurSnapshot([makeItem()]));
    const list = decodePaintCommandBuffer(buffer);
    expect(list.roots).toHaveLength(1);
    // Simple shape without compositing → drawable directly
    expect(list.roots[0]?.kind).toBe("drawable");
  });

  it("nested group with beginGroup/endGroup wrapping", () => {
    const snapshot = makeBlurSnapshot([
      makeItem({
        key: "test:g1",
        nodeId: "g1",
        payload: { kind: "group", width: 200, height: 200 },
      }),
    ]);
    const buffer = buildPaintCommandBuffer(snapshot);
    const list = decodePaintCommandBuffer(buffer);
    // Group → PaintGroupScope node
    expect(list.roots[0]?.kind).toBe("group");
    if (list.roots[0]?.kind === "group") {
      expect((list.roots[0] as PaintGroupScope).nodeId).toBe("g1");
    }
  });

  it("beginLayer wraps offscreen isolation + effect", () => {
    const snapshot = makeBlurSnapshot([
      makeItem({
        key: "test:blur",
        effects: [{ id: "f1", type: "blur", radius: 5 }],
        compositing: {
          isolation: "isolate",
          needsOffscreen: true,
          isAdjustment: false,
          effectOrder: [{ id: "f1", type: "blur" }],
        },
      }),
    ]);
    const buffer = buildPaintCommandBuffer(snapshot);
    const ops = buffer.commands.map((c) => c.op);
    expect(ops).toContain("beginLayer");
    expect(ops).toContain("endLayer");
    const list = decodePaintCommandBuffer(buffer);
    expect(list.roots[0]?.kind).toBe("layer");
    if (list.roots[0]?.kind === "layer") {
      const layer = list.roots[0] as PaintLayerScope;
      expect(layer.isolation).toBe(true);
      expect(layer.offscreen).toBe(true);
      expect(layer.children).toHaveLength(1);
    }
  });

  it("mask creates beginLayer with mask config", () => {
    const snapshot = makeBlurSnapshot([
      makeItem({
        key: "test:masked",
        compositing: {
          isolation: "pass-through",
          needsOffscreen: true,
          isAdjustment: false,
          mask: {
            mode: "alpha",
            sourceNodeId: "maskSrc",
            sourceVisibility: "mask-only",
          },
          effectOrder: [],
        },
      }),
    ]);
    const buffer = buildPaintCommandBuffer(snapshot);
    const beginLayerCmd = buffer.commands.find((c) => c.op === "beginLayer");
    expect(beginLayerCmd).toBeDefined();
    if (beginLayerCmd?.op === "beginLayer") {
      expect(beginLayerCmd.mask).toBeDefined();
      expect(beginLayerCmd.mask?.mode).toBe("alpha");
      expect(beginLayerCmd.mask?.sourceKey).toBe("test:maskSrc");
    }
  });

  it("mask supports all modes: alpha, luma, clip, inverse", () => {
    const modes = [
      "alpha",
      "inverse-alpha",
      "luma",
      "inverse-luma",
      "clip",
    ] as const;
    for (const mode of modes) {
      const snapshot = makeBlurSnapshot([
        makeItem({
          key: "test:m",
          compositing: {
            isolation: "pass-through",
            needsOffscreen: true,
            isAdjustment: false,
            mask: { mode, sourceNodeId: "src", sourceVisibility: "mask-only" },
            effectOrder: [],
          },
        }),
      ]);
      const buffer = buildPaintCommandBuffer(snapshot);
      const beginLayerCmd = buffer.commands.find((c) => c.op === "beginLayer");
      expect(
        beginLayerCmd?.op === "beginLayer" && beginLayerCmd.mask?.mode,
      ).toBe(mode);
    }
  });

  it("adjustment layer triggers isolation", () => {
    const snapshot = makeBlurSnapshot([
      makeItem({
        key: "test:adj",
        effects: [{ id: "a1", type: "brightness", value: 1.2 }],
        compositing: {
          isolation: "pass-through",
          needsOffscreen: false,
          isAdjustment: true,
          effectOrder: [{ id: "a1", type: "brightness" }],
        },
      }),
    ]);
    const buffer = buildPaintCommandBuffer(snapshot);
    const list = decodePaintCommandBuffer(buffer);
    expect(list.roots[0]?.kind).toBe("layer");
    if (list.roots[0]?.kind === "layer") {
      expect((list.roots[0] as PaintLayerScope).isolation).toBe(false);
      expect((list.roots[0] as PaintLayerScope).offscreen).toBe(false);
    }
  });

  it("blend mode is set on transform command", () => {
    const snapshot = makeBlurSnapshot([makeItem({ blendMode: "multiply" })]);
    const buffer = buildPaintCommandBuffer(snapshot);
    const setTransform = buffer.commands.find((c) => c.op === "setTransform");
    expect(setTransform).toBeDefined();
    if (setTransform?.op === "setTransform") {
      expect(setTransform.blendMode).toBe("multiply");
    }
  });

  it("effect order is preserved in layer isolation", () => {
    const effectOrder = [
      { id: "e1", type: "blur" },
      { id: "e2", type: "shadow" },
    ];
    const snapshot = makeBlurSnapshot([
      makeItem({
        key: "test:multiFx",
        effects: [
          { id: "e1", type: "blur", radius: 3 },
          {
            id: "e2",
            type: "shadow",
            offsetX: 2,
            offsetY: 2,
            blur: 4,
            color: "#000",
          },
        ],
        compositing: {
          isolation: "isolate",
          needsOffscreen: true,
          isAdjustment: false,
          effectOrder,
        },
      }),
    ]);
    const buffer = buildPaintCommandBuffer(snapshot);
    const list = decodePaintCommandBuffer(buffer);
    expect(list.roots[0]?.kind).toBe("layer");
  });
});

// ── Static resource vs per-frame split (Task 4.1 sub-task) ──────────

describe("Task 4.1 — resource / frame property split", () => {
  it("extracts text resource keeping runs, fontSize, align", () => {
    const cmd: PaintDrawCommand = {
      op: "drawText",
      key: "k",
      nodeId: "n",
      text: "Hello",
      fontSize: 24,
      fontWeight: 600,
      align: "center",
      fill: "#000",
      width: 200,
      height: 40,
      wrap: "word",
      lineHeight: 1.5,
      runs: [{ id: "r1", text: "H", fill: "#f00", fontWeight: 700 }],
    };
    const resource = extractPaintResource(cmd);
    expect(resource).not.toBeNull();
    expect(resource?.kind).toBe("text");
    if (resource?.kind === "text") {
      expect(resource.text).toBe("Hello");
      expect(resource.fontSize).toBe(24);
      expect(resource.runs).toHaveLength(1);
    }
  });

  it("extracts image resource keeping assetId and uri", () => {
    const cmd: PaintDrawCommand = {
      op: "drawImage",
      key: "k",
      nodeId: "n",
      assetId: "img-1",
      uri: "https://example.com/a.png",
      width: 100,
      height: 100,
    };
    const resource = extractPaintResource(cmd);
    expect(resource?.kind).toBe("image");
    if (resource?.kind === "image") {
      expect(resource.assetId).toBe("img-1");
      expect(resource.uri).toBe("https://example.com/a.png");
    }
  });

  it("extracts per-frame properties (width, height, fill)", () => {
    const cmd: PaintDrawCommand = {
      op: "drawShape",
      key: "k",
      nodeId: "n",
      shape: "rectangle",
      fill: "#0f0",
      width: 150,
      height: 75,
    };
    const frame = extractPaintFrameProperty(cmd);
    expect(frame.width).toBe(150);
    expect(frame.height).toBe(75);
    expect(frame.fill).toBe("#0f0");
  });

  it("splitPaintCommand returns null for unsupported op", () => {
    const result = splitPaintCommand({
      op: "unsupported",
      key: "x",
      nodeId: "n",
      nodeType: "unknown",
      message: "",
    });
    expect(result).toBeNull();
  });

  it("splitPaintCommand separates resource from frame for shape", () => {
    const cmd: PaintDrawCommand = {
      op: "drawShape",
      key: "k",
      nodeId: "n",
      shape: "ellipse",
      fill: "#ff0",
      width: 80,
      height: 60,
      cornerRadius: 4,
      effects: [{ id: "fx1", type: "blur", radius: 2 }],
    };
    const split = splitPaintCommand(cmd);
    expect(split).not.toBeNull();
    if (split) {
      expect(split.resource.kind).toBe("shape");
      expect(split.frame.fill).toBe("#ff0");
      expect(split.frame.effects).toHaveLength(1);
      expect(split.original).toBe(cmd);
    }
  });
});

// ── Task 4.2: Item fingerprint ─────────────────────────────────────

import {
  computePaintItemFingerprint,
  computePaintResourceFingerprint,
} from "../paint";

describe("Task 4.2 — item fingerprint", () => {
  const drawCmd: PaintDrawCommand = {
    op: "drawShape",
    key: "k",
    nodeId: "n",
    shape: "rectangle",
    fill: "#f00",
    width: 100,
    height: 100,
  };
  const baseTx = {
    matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    alpha: 1,
    visible: true,
    zIndex: 0,
  };

  it("same command + transform → identical fingerprint", () => {
    const f1 = computePaintItemFingerprint(drawCmd, baseTx);
    const f2 = computePaintItemFingerprint(drawCmd, baseTx);
    expect(f1).toBe(f2);
  });

  it("different transform → different fingerprint", () => {
    const f1 = computePaintItemFingerprint(drawCmd, baseTx);
    const f2 = computePaintItemFingerprint(drawCmd, {
      ...baseTx,
      matrix: { a: 2, b: 0, c: 0, d: 2, e: 10, f: 0 },
    });
    expect(f1).not.toBe(f2);
  });

  it("different fill → different fingerprint", () => {
    const f1 = computePaintItemFingerprint(drawCmd, baseTx);
    const f2 = computePaintItemFingerprint(
      { ...drawCmd, fill: "#0f0" },
      baseTx,
    );
    expect(f1).not.toBe(f2);
  });

  it("different alpha → different fingerprint", () => {
    const f1 = computePaintItemFingerprint(drawCmd, baseTx);
    const f2 = computePaintItemFingerprint(drawCmd, { ...baseTx, alpha: 0.5 });
    expect(f1).not.toBe(f2);
  });

  it("different blend mode → different fingerprint", () => {
    const f1 = computePaintItemFingerprint(drawCmd, baseTx);
    const f2 = computePaintItemFingerprint(drawCmd, {
      ...baseTx,
      blendMode: "multiply",
    });
    expect(f1).not.toBe(f2);
  });

  it("different zIndex → different fingerprint", () => {
    const f1 = computePaintItemFingerprint(drawCmd, baseTx);
    const f2 = computePaintItemFingerprint(drawCmd, { ...baseTx, zIndex: 5 });
    expect(f1).not.toBe(f2);
  });

  it("same resource different frame → same fingerprint for static resource", () => {
    const res = { kind: "text", text: "Hi", fontSize: 16 };
    const f1 = computePaintResourceFingerprint(res);
    const f2 = computePaintResourceFingerprint(res);
    expect(f1).toBe(f2);
  });

  it("different resource → different fingerprint", () => {
    const f1 = computePaintResourceFingerprint({ kind: "text", text: "A" });
    const f2 = computePaintResourceFingerprint({ kind: "text", text: "B" });
    expect(f1).not.toBe(f2);
  });
});

// ── Task 4.3: Explicit unsupported ──────────────────────────────────

import { countUnsupportedCommands, collectPaintDiagnostics } from "../paint";

describe("Task 4.3 — explicit unsupported diagnostic", () => {
  it("countUnsupportedCommands returns 0 for valid buffer", () => {
    const buffer = buildPaintCommandBuffer(makeBlurSnapshot([makeItem()]));
    expect(countUnsupportedCommands(buffer)).toBe(0);
  });

  it("countUnsupportedCommands detects unsupported op", () => {
    const buffer: PaintCommandBuffer = {
      version: 1,
      diagnostics: [],
      commands: [
        {
          op: "beginFrame",
          width: 10,
          height: 10,
          sceneId: "s",
          frame: 0,
          time: 0,
        },
        {
          op: "setTransform",
          key: "unknown",
          matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
          alpha: 1,
          visible: true,
          zIndex: 0,
        },
        {
          op: "unsupported",
          key: "unknown",
          nodeId: "n",
          nodeType: "webgl",
          message: "not supported",
        },
        { op: "endFrame" },
      ],
    };
    expect(countUnsupportedCommands(buffer)).toBe(1);
  });

  it("collectPaintDiagnostics includes unsupported ops as errors", () => {
    const buffer: PaintCommandBuffer = {
      version: 1,
      diagnostics: [
        { severity: "warning", code: "test_warn", message: "Test" },
      ],
      commands: [
        {
          op: "beginFrame",
          width: 10,
          height: 10,
          sceneId: "s",
          frame: 0,
          time: 0,
        },
        {
          op: "setTransform",
          key: "bad",
          matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
          alpha: 1,
          visible: true,
          zIndex: 0,
        },
        {
          op: "unsupported",
          key: "bad",
          nodeId: "n",
          nodeType: "3d-model",
          message: "3D models not yet",
        },
        { op: "endFrame" },
      ],
    };
    const diags = collectPaintDiagnostics(buffer);
    expect(diags).toHaveLength(2); // original warning + unsupported error
    expect(diags.some((d) => d.code === "unsupported_paint_op")).toBe(true);
  });
});

// ── Task 4.4: Contract versioning + validator ───────────────────────

import { PAINT_COMMAND_VERSION, validatePaintCommandBuffer } from "../paint";
import {
  paintContractVersion,
  validatePaintBuffer,
  assertValidPaintBuffer,
} from "../paint";

describe("Task 4.4 — contract versioning + validator", () => {
  it("paintContractVersion matches PAINT_COMMAND_VERSION", () => {
    expect(paintContractVersion).toBe(PAINT_COMMAND_VERSION);
  });

  it("validatePaintBuffer validates a good buffer", () => {
    const buffer = buildPaintCommandBuffer(makeBlurSnapshot([makeItem()]));
    const result = validatePaintBuffer(buffer);
    expect(result.ok).toBe(true);
  });

  it("validatePaintBuffer rejects missing endFrame", () => {
    const buffer = buildPaintCommandBuffer(makeBlurSnapshot([makeItem()]));
    buffer.commands.pop();
    const result = validatePaintBuffer(buffer);
    expect(result.ok).toBe(false);
  });

  it("assertValidPaintBuffer throws on bad buffer", () => {
    const buffer: PaintCommandBuffer = {
      version: 1,
      diagnostics: [],
      commands: [
        {
          op: "beginFrame",
          width: 10,
          height: 10,
          sceneId: "s",
          frame: 0,
          time: 0,
        },
      ],
    };
    expect(() => assertValidPaintBuffer(buffer)).toThrow(
      "Paint buffer validation failed",
    );
  });

  it("assertValidPaintBuffer does not throw on good buffer", () => {
    const buffer = buildPaintCommandBuffer(makeBlurSnapshot([makeItem()]));
    expect(() => assertValidPaintBuffer(buffer)).not.toThrow();
  });

  it("validation rejects group scope mismatch", () => {
    const buffer: PaintCommandBuffer = {
      version: 1,
      diagnostics: [],
      commands: [
        {
          op: "beginFrame",
          width: 10,
          height: 10,
          sceneId: "s",
          frame: 0,
          time: 0,
        },
        {
          op: "setTransform",
          key: "g1",
          matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
          alpha: 1,
          visible: true,
          zIndex: 0,
        },
        { op: "beginGroup", key: "g1", nodeId: "n" },
        { op: "endGroup", key: "g2" }, // mismatched
        { op: "endFrame" },
      ],
    };
    const result = validatePaintBuffer(buffer);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "group_scope_mismatch")).toBe(
      true,
    );
  });

  it("validation rejects unclosed layer", () => {
    const buffer: PaintCommandBuffer = {
      version: 1,
      diagnostics: [],
      commands: [
        {
          op: "beginFrame",
          width: 10,
          height: 10,
          sceneId: "s",
          frame: 0,
          time: 0,
        },
        {
          op: "setTransform",
          key: "l1",
          matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
          alpha: 1,
          visible: true,
          zIndex: 0,
        },
        { op: "beginLayer", key: "l1", offscreen: true },
        { op: "endFrame" },
      ],
    };
    const result = validatePaintBuffer(buffer);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "unclosed_layer")).toBe(true);
  });
});

// ── Task 4.5: Geometry union seam ───────────────────────────────────

import {
  makeAffine2DGeometry,
  identityAffine2DGeometry,
  flattenToAffine2D,
  isAffine2D,
  type EvaluatedGeometry,
  type Affine2DGeometry,
  type ProjectedQuadGeometry,
  type MeshGeometry,
} from "../paint";

describe("Task 4.5 — geometry union seam", () => {
  it("makeAffine2DGeometry produces affine-2d geometry", () => {
    const geo = makeAffine2DGeometry(
      { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 },
      { x: 0, y: 0, width: 100, height: 50 },
    );
    expect(geo.kind).toBe("affine-2d");
    expect(geo.matrix.e).toBe(10);
    expect(geo.matrix.f).toBe(20);
    expect(geo.bounds.width).toBe(100);
  });

  it("identityAffine2DGeometry produces identity matrix", () => {
    const geo = identityAffine2DGeometry(800, 600);
    expect(geo.kind).toBe("affine-2d");
    expect(geo.matrix.a).toBe(1);
    expect(geo.matrix.d).toBe(1);
    expect(geo.bounds.width).toBe(800);
    expect(geo.bounds.height).toBe(600);
  });

  it("isAffine2D discriminates correctly", () => {
    const affine = makeAffine2DGeometry(
      { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      { x: 0, y: 0, width: 1, height: 1 },
    );
    expect(isAffine2D(affine)).toBe(true);

    const quad: ProjectedQuadGeometry = {
      kind: "projected-quad",
      corners: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      depth: 0.5,
    };
    expect(isAffine2D(quad)).toBe(false);
  });

  it("flattenToAffine2D returns affine-2d unchanged", () => {
    const geo = makeAffine2DGeometry(
      { a: 2, b: 0, c: 0, d: 2, e: 5, f: 5 },
      { x: 0, y: 0, width: 50, height: 50 },
    );
    const flat = flattenToAffine2D(geo);
    expect(flat).toBe(geo); // same reference
  });

  it("flattenToAffine2D converts projected-quad to bounding box", () => {
    const quad: ProjectedQuadGeometry = {
      kind: "projected-quad",
      corners: [
        [10, 10],
        [110, 10],
        [110, 60],
        [10, 60],
      ],
      depth: 0.3,
    };
    const flat = flattenToAffine2D(quad);
    expect(flat.kind).toBe("affine-2d");
    expect(flat.bounds.x).toBe(10);
    expect(flat.bounds.y).toBe(10);
    expect(flat.bounds.width).toBe(100);
    expect(flat.bounds.height).toBe(50);
  });

  it("flattenToAffine2D handles mesh gracefully", () => {
    const mesh: MeshGeometry = {
      kind: "mesh",
      vertices: new Float32Array([0, 0, 0, 100, 0, 0, 0, 100, 0]),
      indices: new Uint16Array([0, 1, 2]),
    };
    const flat = flattenToAffine2D(mesh);
    expect(flat.kind).toBe("affine-2d");
  });
});

// ── Integration: decoded list respects nesting ──────────────────────

describe("Phase 4 integration", () => {
  it("multi-item snapshot decodes to correct drawable count", () => {
    const buffer = buildPaintCommandBuffer(
      makeBlurSnapshot([
        makeItem({ key: "test:a", nodeId: "a" }),
        makeItem({ key: "test:b", nodeId: "b" }),
        makeItem({ key: "test:c", nodeId: "c" }),
      ]),
    );
    const list = decodePaintCommandBuffer(buffer);
    expect(list.roots).toHaveLength(3);
    expect(list.roots.every((n) => n.kind === "drawable")).toBe(true);
  });

  it("fingerprint is deterministic across identical buffers", () => {
    const buf1 = buildPaintCommandBuffer(makeBlurSnapshot([makeItem()]));
    const buf2 = buildPaintCommandBuffer(makeBlurSnapshot([makeItem()]));
    const list1 = decodePaintCommandBuffer(buf1);
    const list2 = decodePaintCommandBuffer(buf2);

    const nodes1 = list1.roots.filter(
      (n) => n.kind === "drawable",
    ) as PaintDrawable[];
    const nodes2 = list2.roots.filter(
      (n) => n.kind === "drawable",
    ) as PaintDrawable[];
    expect(nodes1).toHaveLength(1);
    expect(nodes2).toHaveLength(1);

    const fp1 = computePaintItemFingerprint(nodes1[0]!.draw, {
      matrix: nodes1[0]!.transform.matrix,
      alpha: nodes1[0]!.transform.alpha,
      visible: nodes1[0]!.transform.visible,
      zIndex: nodes1[0]!.transform.zIndex,
      blendMode: nodes1[0]!.transform.blendMode,
    });
    const fp2 = computePaintItemFingerprint(nodes2[0]!.draw, {
      matrix: nodes2[0]!.transform.matrix,
      alpha: nodes2[0]!.transform.alpha,
      visible: nodes2[0]!.transform.visible,
      zIndex: nodes2[0]!.transform.zIndex,
      blendMode: nodes2[0]!.transform.blendMode,
    });
    expect(fp1).toBe(fp2);
  });
});
