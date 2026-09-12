import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compileDocument } from "@motionvideo/html-compiler";
import { compileProtocolToPaintCommands } from "@motionvideo/motion-compiler";
import {
  summarizePaintCommandBuffer,
  validatePaintBuffer,
  type PaintCommand,
  type PaintCommandBuffer,
} from "@motionvideo/motion-runtime";
import { HTML_COMPILER_PREVIEW_FONT_ASSETS } from "@/lib/docs/html-compiler-preview";
import { HTML_PLAYGROUND_CASES } from "@/lib/playground/html-playground-cases";

const GRID_CASE_IDS = [
  "review-grid-opacity-thirty",
  "review-grid-default-opacity",
  "review-grid-composition-baseline",
  "review-grid-composition-baseline-1px",
  "review-grid-repeat-x",
  "review-grid-repeat-y",
  "review-grid-no-repeat",
] as const;

const INSET_CASE_IDS = [
  "phase8-inset-rounded-small",
  "phase8-inset-rounded-medium",
  "phase8-inset-rounded-large",
  "phase8-inset-transparent-rounded-small",
  "phase8-inset-transparent-rounded-medium",
  "phase8-inset-transparent-rounded-large",
] as const;

const EXPECTED_INSET_RADIUS: Record<(typeof INSET_CASE_IDS)[number], number> = {
  "phase8-inset-rounded-small": 48,
  "phase8-inset-rounded-medium": 48,
  "phase8-inset-rounded-large": 48,
  "phase8-inset-transparent-rounded-small": 16,
  "phase8-inset-transparent-rounded-medium": 64,
  "phase8-inset-transparent-rounded-large": 112,
};

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

describe("Focused HTML playground Runtime command contract", () => {
  it.each([...GRID_CASE_IDS, ...INSET_CASE_IDS])("emits a valid command stream for %s", (id) => {
    const buffer = compileFixture(id);
    expect(validatePaintBuffer(buffer).ok, id).toBe(true);
    expect(buffer.commands[0]?.op, id).toBe("beginFrame");
    expect(buffer.commands.at(-1)?.op, id).toBe("endFrame");
  });

  it("keeps one transform paired with every grid drawable", () => {
    for (const id of GRID_CASE_IDS) {
      const buffer = compileFixture(id);
      const summary = summarizePaintCommandBuffer(buffer);
      const draws = buffer.commands.filter((command): command is PaintCommand => [
        "drawText", "drawShape", "drawSolid", "drawImage", "drawPath", "drawVideo", "unsupported",
      ].includes(command.op));
      expect(summary.transformKeys, id).toEqual(draws.map((command) => command.key));
    }
  });

  it.each(INSET_CASE_IDS)("uses a rounded box alpha mask for %s", (id) => {
    const buffer = compileFixture(id);
    const layer = buffer.commands.find((command): command is Extract<PaintCommand, { op: "beginLayer" }> => command.op === "beginLayer");
    expect(layer?.effectProgram?.ops[0], id).toMatchObject({ kind: "alpha-mask", source: "box" });
    expect(layer?.effectBox, id).toMatchObject({
      width: 680,
      height: 360,
      cornerRadius: EXPECTED_INSET_RADIUS[id],
    });
  });
});
