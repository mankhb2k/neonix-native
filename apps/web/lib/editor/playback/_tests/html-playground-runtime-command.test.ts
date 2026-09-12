import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compileDocument } from "@motionvideo/html-compiler";
import { compileProtocolToPaintCommands } from "@motionvideo/motion-compiler";
import { summarizePaintCommandBuffer, validatePaintBuffer, type PaintCommand, type PaintCommandBuffer } from "@motionvideo/motion-runtime";
import { HTML_COMPILER_PREVIEW_FONT_ASSETS } from "@/lib/docs/html-compiler-preview";
import { HTML_PLAYGROUND_CASES } from "@/lib/playground/html-playground-cases";

const PHASE2_CASE_IDS = [
  "phase2-single-rect",
  "phase2-single-opacity",
  "phase2-rounded-shape",
  "phase2-two-shape-overlap",
  "phase2-three-shape-order",
  "phase2-shape-text-image",
  "phase2-border-background",
  "phase2-multiple-backgrounds",
] as const;

function fixtureHtml(id: string): string {
  if (!HTML_PLAYGROUND_CASES.some((candidate) => candidate.id === id)) {
    throw new Error(`Unknown playground fixture: ${id}`);
  }
  const candidates = [
    resolve(process.cwd(), "public/playground/fixtures", `${id}.html`),
    resolve(process.cwd(), "apps/web/public/playground/fixtures", `${id}.html`),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) throw new Error(`Fixture file is missing: ${id}`);
  return readFileSync(path, "utf8");
}

function compileFixture(id: string): PaintCommandBuffer {
  const result = compileDocument(
    { html: fixtureHtml(id) },
    { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS },
  );
  expect(result.status, id).toBe("success");
  if (!result.protocol) throw new Error(`Fixture ${id} did not produce Protocol V2`);
  return compileProtocolToPaintCommands(result.protocol, { frame: 0 });
}

function drawCommands(buffer: PaintCommandBuffer): PaintCommand[] {
  return buffer.commands.filter((command) => [
    "drawText", "drawShape", "drawSolid", "drawImage", "drawPath", "drawVideo", "unsupported",
  ].includes(command.op));
}

describe("Phase 3 HTML playground Runtime command contract", () => {
  it.each(PHASE2_CASE_IDS)("emits a valid command stream for %s", (id) => {
    const buffer = compileFixture(id);
    const validation = validatePaintBuffer(buffer);
    expect(validation.ok, id).toBe(true);
    expect(buffer.commands[0]?.op, id).toBe("beginFrame");
    expect(buffer.commands.at(-1)?.op, id).toBe("endFrame");
  });

  it("keeps one transform paired with every drawable", () => {
    for (const id of PHASE2_CASE_IDS) {
      const buffer = compileFixture(id);
      const summary = summarizePaintCommandBuffer(buffer);
      const draws = drawCommands(buffer);
      expect(summary.operationCounts.beginFrame, id).toBe(1);
      expect(summary.operationCounts.endFrame, id).toBe(1);
      expect(summary.transformKeys, id).toEqual(draws.map((command) => command.key));
      expect(new Set(summary.drawKeys).size, id).toBe(summary.drawKeys.length);
    }
  });

  it("keeps layer scope boundaries balanced and ordered", () => {
    for (const id of PHASE2_CASE_IDS) {
      const buffer = compileFixture(id);
      const openLayers: string[] = [];
      const openGroups: string[] = [];
      for (const command of buffer.commands) {
        if (command.op === "beginLayer") openLayers.push(command.key);
        if (command.op === "endLayer") expect(openLayers.pop(), id).toBe(command.key);
        if (command.op === "beginGroup") openGroups.push(command.key);
        if (command.op === "endGroup") expect(openGroups.pop(), id).toBe(command.key);
      }
      expect(openLayers, id).toEqual([]);
      expect(openGroups, id).toEqual([]);
    }
  });

  it("preserves the expected alpha and draw order for overlap controls", () => {
    const opacity = compileFixture("phase2-single-opacity");
    const opacityTransform = opacity.commands.find((command) => command.op === "setTransform");
    expect(opacityTransform).toMatchObject({ alpha: 0.3 });

    const overlap = compileFixture("phase2-two-shape-overlap");
    const overlapTransforms = overlap.commands.filter((command): command is Extract<PaintCommand, { op: "setTransform" }> => command.op === "setTransform");
    expect(overlapTransforms).toHaveLength(2);
    expect(overlapTransforms.map((command) => command.alpha)).toEqual([0.55, 0.58]);

    const ordered = compileFixture("phase2-three-shape-order");
    const orderedTransforms = ordered.commands.filter((command): command is Extract<PaintCommand, { op: "setTransform" }> => command.op === "setTransform");
    expect(orderedTransforms).toHaveLength(3);
    expect(orderedTransforms.map((command) => command.order)).toEqual([...orderedTransforms].sort((a, b) => a.order - b.order).map((command) => command.order));
  });
});
