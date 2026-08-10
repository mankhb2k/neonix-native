/**
 * Phase 1 — v2 compile snapshot tests.
 *
 * Every v2 fixture is compiled to `MotionRuntimeProject` and the output
 * is compared against a checked-in golden file. Goldens can be refreshed with
 * `UPDATE_GOLDENS=1` when a compile change is intentional.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { compileMotionProjectV2 } from "../index";
import {
  parseMotionProjectV2,
  parseMotionComponentV2,
  type MotionComponentV2,
} from "@motionvideo/motion-protocol";

const projectFixtureDir = fileURLToPath(
  new URL("../../../motion-protocol/src/__fixtures__/v2", import.meta.url),
);
const goldenDir = fileURLToPath(
  new URL("../__fixtures__/v2-compile-goldens", import.meta.url),
);

const UPDATE_GOLDENS = process.env.UPDATE_GOLDENS === "1";

const FIXTURE_NAMES = [
  "minimal-empty",
  "single-scene",
  "multi-asset",
  "clips-and-tracks",
  "captions",
  "transition",
  "variables-bindings",
  "component-instance",
] as const;

function loadProjectJson(name: string): unknown {
  const file = path.join(projectFixtureDir, `${name}.project.json`);
  return JSON.parse(readFileSync(file, "utf8")) as unknown;
}

function loadComponent(name: string): MotionComponentV2 {
  const file = path.join(projectFixtureDir, `${name}.component.json`);
  return parseMotionComponentV2(JSON.parse(readFileSync(file, "utf8")));
}

function normalizeGolden(json: string): string {
  return `${json.replace(/\s+$/u, "")}\n`;
}

function readGolden(name: string): string | undefined {
  const file = path.join(goldenDir, `${name}.runtime.json`);
  if (!existsSync(file)) return undefined;
  return readFileSync(file, "utf8");
}

function writeGolden(name: string, json: string): void {
  mkdirSync(goldenDir, { recursive: true });
  writeFileSync(
    path.join(goldenDir, `${name}.runtime.json`),
    normalizeGolden(json),
    "utf8",
  );
}

function compileFixture(name: string): {
  ok: boolean;
  json: string;
  diagnostics?: Array<{ severity: string; code: string; message: string }>;
} {
  const input = loadProjectJson(name);
  const project = parseMotionProjectV2(input);
  const components =
    name === "component-instance" ? [loadComponent("logo-reveal")] : [];
  const result = compileMotionProjectV2(project, { components });
  if (!result.ok) {
    return {
      ok: false,
      json: "",
      diagnostics: result.diagnostics.map((diagnostic) => ({
        severity: diagnostic.severity,
        code: diagnostic.code,
        message: diagnostic.message,
      })),
    };
  }
  return { ok: true, json: JSON.stringify(result.project, null, 2) };
}

describe("v2 compile snapshots", () => {
  for (const name of FIXTURE_NAMES) {
    it(`compiles ${name}.project.json deterministically`, () => {
      const first = compileFixture(name);
      expect(first.ok, JSON.stringify(first.diagnostics ?? [], null, 2)).toBe(
        true,
      );
      const second = compileFixture(name);
      expect(second.json).toBe(first.json);
    });

    it(`matches golden for ${name}.project.json`, () => {
      const { ok, json } = compileFixture(name);
      expect(ok).toBe(true);
      const golden = readGolden(name);
      if (golden === undefined || UPDATE_GOLDENS) {
        writeGolden(name, json);
        return; // First run (or refresh) records the golden.
      }
      expect(normalizeGolden(json)).toBe(golden);
    });
  }
});
