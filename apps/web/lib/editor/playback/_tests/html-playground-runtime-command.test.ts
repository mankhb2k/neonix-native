import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compileDocument } from "@motionvideo/html-compiler";
import { compileProtocolToPaintCommands } from "@motionvideo/motion-compiler";
import {
  validatePaintBuffer,
  type PaintCommandBuffer,
} from "@motionvideo/motion-runtime";
import { HTML_COMPILER_PREVIEW_FONT_ASSETS } from "@/lib/docs/html-compiler-preview";
import { HTML_PLAYGROUND_CASES } from "@/lib/playground/html-playground-cases";

const OUTER_CASE_IDS = [
  "box-shadow-outer-glow",
  "inner-glow",
  "combined-glow",
] as const;

const FILTER_TOPIC_IDS = [
  "filter-blur",
  "filter-brightness",
  "filter-contrast",
  "filter-grayscale",
  "filter-sepia",
  "filter-invert",
  "filter-drop-shadow",
  "filter-order",
] as const;

function fixtureHtml(id: string): string {
  const item = HTML_PLAYGROUND_CASES.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`Unknown playground fixture: ${id}`);
  }
  const relativePath = item.url.replace(/^\//, "");
  const candidates = [
    resolve(process.cwd(), "public", relativePath),
    resolve(process.cwd(), "apps/web/public", relativePath),
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
  it.each([...OUTER_CASE_IDS, ...FILTER_TOPIC_IDS])("emits a valid command stream for %s", (id) => {
    const buffer = compileFixture(id);
    expect(validatePaintBuffer(buffer).ok, id).toBe(true);
    expect(buffer.commands[0]?.op, id).toBe("beginFrame");
    expect(buffer.commands.at(-1)?.op, id).toBe("endFrame");
  });
});
