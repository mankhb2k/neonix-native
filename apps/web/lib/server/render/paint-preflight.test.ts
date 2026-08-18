import { describe, expect, it } from "vitest";
import {
  PAINT_COMMAND_VERSION,
  type PaintCommandBuffer,
} from "@motionvideo/motion-runtime";
import {
  preflightPaintCommandBuffer,
  preflightRenderManifest,
} from "./paint-preflight";
import { buildStubRenderManifest } from "./build-manifest";

describe("paint-preflight", () => {
  it("accepts a valid paint buffer", () => {
    const paint: PaintCommandBuffer = {
      version: PAINT_COMMAND_VERSION,
      diagnostics: [],
      commands: [
        {
          op: "beginFrame",
          width: 10,
          height: 10,
          graphId: "s",
          frame: 0,
          time: 0,
        },
        { op: "endFrame" },
      ],
    };
    expect(preflightPaintCommandBuffer(paint).ok).toBe(true);
  });

  it("fails on unsupported ops", () => {
    const paint: PaintCommandBuffer = {
      version: PAINT_COMMAND_VERSION,
      diagnostics: [],
      commands: [
        {
          op: "beginFrame",
          width: 10,
          height: 10,
          graphId: "s",
          frame: 0,
          time: 0,
        },
        {
          op: "setTransform",
          key: "k",
          matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
          alpha: 1,
          visible: true,
          zIndex: 0,
        },
        {
          op: "unsupported",
          key: "k",
          layerId: "n",
          nodeType: "mesh",
          message: "no",
        },
        { op: "endFrame" },
      ],
    };
    const result = preflightPaintCommandBuffer(paint);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "unsupported_paint_op")).toBe(
      true,
    );
  });

  it("gates production export on preflight", () => {
    const manifest = buildStubRenderManifest({
      projectId: "p1",
      projectRevision: 1,
      preset: "preview-720p",
    });
    const result = preflightRenderManifest(manifest, {
      requireProductionGate: true,
      assets: [
        {
          id: "a1",
          uri: "https://example.com/a.png",
          mimeType: "image/png",
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((i) => i.code === "asset_integrity_missing"),
    ).toBe(true);
  });
});
