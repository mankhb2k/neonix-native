import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import * as harfBuzz from "harfbuzzjs";
import { identityMatrix4, orthographicProjectionMatrix } from "../matrix4";
import { evaluateRuntimeProjectV2 } from "./evaluate";
import { prepareRuntimeProjectV2Text } from "./text-layout";
import type { RuntimeProjectV2 } from "./types";

const project: RuntimeProjectV2 = {
  format: "motion-runtime",
  formatVersion: 2,
  id: "runtime-v2-text",
  composition: { width: 640, height: 320, fps: 30, graphId: "runtime-v2-text" },
  view: { worldToClipMatrix: orthographicProjectionMatrix(640, 320, 1, 1, 4000) },
  nodes: [{
    id: "headline",
    parentId: null,
    zIndex: 0,
    timing: { start: 0, duration: 3 },
    opacity: 1,
    visible: true,
    localMatrix: identityMatrix4(),
    worldMatrix: identityMatrix4(),
    content: {
      kind: "text",
      text: "NeonVideo",
      fontAssetId: "roboto-regular",
      fontUri: "/fonts/Roboto-Regular.ttf",
      fontIntegrity: "sha256:15256405ecb0d880678833a582760efad538ab2932318b52c8105b267d159459",
      fontSize: 72,
      lineHeight: 88,
      letterSpacing: 1,
      align: "center",
      verticalAlign: "middle",
      wrap: "none",
      overflow: "visible",
      direction: "ltr",
      language: "en",
      fill: "#ffffff",
      width: 640,
      height: 320,
    },
  }],
};

describe("Runtime V2 text layout", () => {
  it("keeps unprepared text out of the paint stream", () => {
    const frame = evaluateRuntimeProjectV2(project, 0);
    expect(frame.commands.map((command) => command.op)).toEqual([
      "beginFrame",
      "setTransform",
      "endFrame",
    ]);
    expect(frame.diagnostics.map((diagnostic) => diagnostic.code)).toContain("runtime_v2_text_unprepared");
  });

  it("shapes an exact font binary into positioned glyph outlines", async () => {
    const bytes = await readFile(new URL("../../../../assets/fonts/Roboto/static/Roboto-Regular.ttf", import.meta.url));
    const prepared = await prepareRuntimeProjectV2Text(project, async () => bytes, async () => harfBuzz);
    expect(prepared.diagnostics).toEqual([]);
    const frame = evaluateRuntimeProjectV2(prepared.project, 0);
    const text = frame.commands.find((command) => command.op === "drawText");
    expect(text).toMatchObject({
      op: "drawText",
      key: "headline",
      align: "center",
      verticalAlign: "middle",
    });
    if (!text || text.op !== "drawText") throw new Error("Missing text paint command");
    expect(text.glyphs?.length).toBeGreaterThan(0);
    expect(text.glyphs?.every((glyph) => glyph.path.length > 0)).toBe(true);
    expect(text.lines?.[0]?.advanceWidth).toBeGreaterThan(0);
  });

  it("positions a single line inside the immutable frame for every alignment", async () => {
    const bytes = await readFile(new URL("../../../../assets/fonts/Roboto/static/Roboto-Regular.ttf", import.meta.url));
    const prepare = async (align: "left" | "center" | "right", verticalAlign: "top" | "middle" | "bottom") => {
      const next: RuntimeProjectV2 = {
        ...project,
        nodes: project.nodes.map((node) => node.content.kind === "text"
          ? { ...node, content: { ...node.content, text: "A", align, verticalAlign } }
          : node),
      };
      const prepared = await prepareRuntimeProjectV2Text(next, async () => bytes, async () => harfBuzz);
      const content = prepared.project.nodes[0]!.content;
      if (content.kind !== "text" || !content.layout?.glyphs[0]) throw new Error("Missing glyph");
      return content.layout.glyphs[0];
    };
    const left = await prepare("left", "top");
    const center = await prepare("center", "middle");
    const right = await prepare("right", "bottom");
    expect(left.x).toBeLessThan(center.x);
    expect(center.x).toBeLessThan(right.x);
    expect(left.y).toBeLessThan(center.y);
    expect(center.y).toBeLessThan(right.y);
  });
});
