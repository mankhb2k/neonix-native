import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compileDocument } from "@motionvideo/html-compiler";
import { compileProtocolToPaintCommands } from "@motionvideo/motion-compiler";
import {
  validatePaintBuffer,
  validateRuntimeEffectProgram,
  type PaintCommand,
  type PaintCommandBuffer,
  type RuntimeEffectProgram,
} from "@motionvideo/motion-runtime";
import { HTML_COMPILER_PREVIEW_FONT_ASSETS } from "@/lib/docs/html-compiler-preview";
import { HTML_PLAYGROUND_CASES } from "@/lib/playground/html-playground-cases";

const PHASE4_CASE_IDS = [
  "phase4-filter-chain",
  "phase4-filter-opacity-boundary",
  "phase4-backdrop-filter",
  "phase4-sibling-effects",
] as const;

function fixtureHtml(id: string): string {
  const fixture = HTML_PLAYGROUND_CASES.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`Unknown playground fixture: ${id}`);
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
  expect(result.status, `${id}: ${result.diagnostics?.map((diagnostic) => diagnostic.message).join(" | ") ?? "no diagnostics"}`).toBe("success");
  if (!result.protocol) throw new Error(`Fixture ${id} did not produce Protocol V2`);
  const buffer = compileProtocolToPaintCommands(result.protocol, { frame: 0 });
  expect(validatePaintBuffer(buffer).ok, id).toBe(true);
  return buffer;
}

function beginLayers(buffer: PaintCommandBuffer): Array<Extract<PaintCommand, { op: "beginLayer" }>> {
  return buffer.commands.filter((command): command is Extract<PaintCommand, { op: "beginLayer" }> => command.op === "beginLayer");
}

function programs(buffer: PaintCommandBuffer, field: "effectProgram" | "backdropEffectProgram"): RuntimeEffectProgram[] {
  return beginLayers(buffer)
    .map((command) => command[field])
    .filter((program): program is RuntimeEffectProgram => program !== undefined);
}

function assertValidPrograms(id: string, buffer: PaintCommandBuffer): RuntimeEffectProgram[] {
  const all = [...programs(buffer, "effectProgram"), ...programs(buffer, "backdropEffectProgram")];
  expect(all.length, id).toBeGreaterThan(0);
  for (const program of all) {
    const validation = validateRuntimeEffectProgram(program);
    expect(validation.ok, `${id}: ${validation.diagnostics.map((diagnostic) => diagnostic.message).join(" | ")}`).toBe(true);
    expect(program.output, id).not.toBe("source");
    expect(new Set(program.ops.map((op) => op.output)).size, id).toBe(program.ops.length);
  }
  return all;
}

describe("Phase 4 HTML playground effect programs", () => {
  it("keeps all Phase 4 fixtures registered as shared native-stage inputs", () => {
    for (const id of PHASE4_CASE_IDS) {
      expect(HTML_PLAYGROUND_CASES.find((fixture) => fixture.id === id), id).toMatchObject({
        category: "review",
        nativeStage: true,
        url: `/playground/fixtures/${id}.html`,
      });
    }
  });

  it.each(PHASE4_CASE_IDS)("compiles %s into valid effect graph commands", (id) => {
    const buffer = compileFixture(id);
    expect(buffer.commands[0]?.op, id).toBe("beginFrame");
    expect(buffer.commands.at(-1)?.op, id).toBe("endFrame");
    assertValidPrograms(id, buffer);
  });

  it("preserves authored filter order and allocates a new surface per operator", () => {
    const buffer = compileFixture("phase4-filter-chain");
    const [program] = programs(buffer, "effectProgram");
    expect(program).toBeDefined();
    expect(program?.ops.map((op) => op.kind)).toEqual([
      "blur",
      "color-adjust",
      "alpha-mask",
      "blur",
      "tint",
      "offset",
      "composite",
    ]);
    expect(program?.ops.slice(0, 2).map((op) => [op.input, op.output])).toEqual([
      ["source", "effect:filter:0"],
      ["effect:filter:0", "effect:filter:1"],
    ]);
    expect(program?.ops.slice(2).map((op) => op.kind === "composite"
      ? [op.backdrop, op.source, op.output]
      : [op.input, op.output])).toEqual([
      ["effect:filter:1", "effect:filter:2:alpha"],
      ["effect:filter:2:alpha", "effect:filter:2:blur"],
      ["effect:filter:2:blur", "effect:filter:2:tint"],
      ["effect:filter:2:tint", "effect:filter:2:offset"],
      ["effect:filter:2:offset", "effect:filter:1", "effect:filter:2"],
    ]);
    expect(program?.requiresOffscreen).toBe(true);
  });

  it("keeps filter opacity separate from CSS layer opacity", () => {
    const buffer = compileFixture("phase4-filter-opacity-boundary");
    const layer = beginLayers(buffer).find((command) => command.effectProgram !== undefined);
    expect(layer).toMatchObject({
      isolation: true,
      offscreen: true,
      compositeAlpha: 0.72,
      effectProgram: {
        ops: [
          { kind: "alpha", amount: 0.48 },
          { kind: "color-adjust", contrast: 1.08 },
        ],
      },
    });
  });

  it("keeps backdrop effects on a separate captured program", () => {
    const buffer = compileFixture("phase4-backdrop-filter");
    const backdropLayers = beginLayers(buffer).filter((command) => command.backdropEffectProgram !== undefined);
    expect(backdropLayers).toHaveLength(1);
    expect(backdropLayers[0]).toMatchObject({
      isolation: true,
      offscreen: true,
      backdropEffectProgram: {
        ops: [{ kind: "blur" }, { kind: "color-adjust", contrast: 1.18 }],
      },
    });
    expect(backdropLayers[0]?.effectProgram).toBeUndefined();
  });

  it("keeps sibling effect programs isolated from one another", () => {
    const buffer = compileFixture("phase4-sibling-effects");
    const effectLayers = beginLayers(buffer).filter((command) => command.effectProgram !== undefined);
    expect(effectLayers).toHaveLength(2);
    expect(effectLayers.map((command) => command.effectProgram?.ops.map((op) => op.kind))).toEqual([
      ["blur"],
      ["color-matrix", "alpha-mask", "blur", "tint", "offset", "composite"],
    ]);
    expect(new Set(effectLayers.map((command) => command.key)).size).toBe(2);
    for (const layer of effectLayers) {
      expect(layer.effectProgram?.input).toBe("source");
      expect(layer.effectProgram?.output).not.toBe("source");
    }
  });
});
