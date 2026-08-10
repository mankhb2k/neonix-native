/**
 * Phase 1 — V2 round-trip tests.
 *
 * Guarantees that every v2 fixture survives parse -> serialize -> parse
 * without semantic drift, and that serialization is deterministic.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  parseMotionProjectV2,
  serializeMotionProjectV2,
  MotionProjectV2Schema,
} from "../../index";

const fixtureDir = fileURLToPath(
  new URL("../../__fixtures__/v2", import.meta.url),
);

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

function loadFixture(name: string): unknown {
  const file = path.join(fixtureDir, `${name}.project.json`);
  return JSON.parse(readFileSync(file, "utf8")) as unknown;
}

describe("v2 fixture round-trip", () => {
  for (const name of FIXTURE_NAMES) {
    it(`round-trips ${name}.project.json`, () => {
      const input = loadFixture(name);
      const parsed = parseMotionProjectV2(input);
      // Parse -> serialize -> parse must be identical to first parse.
      const serialized = serializeMotionProjectV2(parsed);
      const reparsed = parseMotionProjectV2(JSON.parse(serialized));
      expect(reparsed).toEqual(parsed);
    });

    it(`serializes ${name}.project.json deterministically`, () => {
      const input = loadFixture(name);
      const parsed = parseMotionProjectV2(input);
      const first = serializeMotionProjectV2(parsed);
      const second = serializeMotionProjectV2(
        parseMotionProjectV2(JSON.parse(first)),
      );
      expect(second).toBe(first);
    });
  }

  it("all 8 required fixtures are present", () => {
    for (const name of FIXTURE_NAMES) {
      const raw = loadFixture(name);
      expect(raw).toBeTypeOf("object");
    }
  });
});

describe("v2 schema negative cases", () => {
  const valid = loadFixture("minimal-empty") as Record<string, unknown>;

  it("rejects missing required fields", () => {
    const { metadata, ...rest } = valid;
    expect(() =>
      MotionProjectV2Schema.parse({ ...rest, metadata: undefined }),
    ).toThrow();
  });

  it("rejects wrong formatVersion", () => {
    expect(() =>
      MotionProjectV2Schema.parse({ ...valid, formatVersion: 3 }),
    ).toThrow();
  });

  it("rejects wrong format discriminator", () => {
    expect(() =>
      MotionProjectV2Schema.parse({ ...valid, format: "motion-runtime" }),
    ).toThrow();
  });

  it("rejects unknown fields (strict)", () => {
    expect(() =>
      MotionProjectV2Schema.parse({ ...valid, unknownRootField: true }),
    ).toThrow();
  });

  it("rejects invalid locale", () => {
    expect(() =>
      MotionProjectV2Schema.parse({
        ...valid,
        metadata: {
          ...(valid.metadata as Record<string, unknown>),
          locale: "en-US",
        },
      }),
    ).toThrow();
  });

  it("rejects invalid aspect ratio", () => {
    expect(() =>
      MotionProjectV2Schema.parse({
        ...valid,
        metadata: {
          ...(valid.metadata as Record<string, unknown>),
          aspectRatio: "4:3",
        },
      }),
    ).toThrow();
  });

  it("rejects invalid JSON input", () => {
    expect(() => parseMotionProjectV2(null)).toThrow();
    expect(() => parseMotionProjectV2("not an object")).toThrow();
  });

  it("rejects duplicate scene ids via reference validation", () => {
    const base = parseMotionProjectV2(loadFixture("single-scene"));
    const duplicated = {
      ...base,
      scenes: [...base.scenes, { ...base.scenes[0]!, id: "intro" }],
      timeline: { ...base.timeline, sceneOrder: ["intro", "intro"] },
    };
    expect(() => parseMotionProjectV2(duplicated)).toThrow();
  });
});
