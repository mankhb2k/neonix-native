import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPhase0Goldens,
  buildPhase0LargeFixture,
  buildPhase0MediumFixture,
  buildPhase0SmallFixture,
  PHASE0_LARGE_CLIP_COUNT,
} from "@/lib/editor/__fixtures__/vite-phase0";

const PHASE0_DIR = path.resolve(
  __dirname,
  "../../../../../docs/migration/vite-phase-0",
);
const FIXTURES_DIR = path.join(PHASE0_DIR, "fixtures");
const GOLDENS_DIR = path.join(PHASE0_DIR, "goldens");

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

describe("Vite Phase 0 fixtures", () => {
  it("builds small / medium / large envelopes with storageVersion 2", () => {
    const small = buildPhase0SmallFixture();
    const medium = buildPhase0MediumFixture();
    const large = buildPhase0LargeFixture();

    expect(small.storageVersion).toBe(2);
    expect(medium.storageVersion).toBe(2);
    expect(large.storageVersion).toBe(2);
    expect(small.project.metadata.id).toBe("vite-phase0.small");
    expect(medium.timelineClips.some((c) => c.kind === "audio")).toBe(true);
    expect(medium.timelineClips.some((c) => c.kind === "scene")).toBe(true);
    expect(large.timelineClips).toHaveLength(PHASE0_LARGE_CLIP_COUNT);
  });

  it("committed fixture JSON matches builders", () => {
    expect(readJson(path.join(FIXTURES_DIR, "small.project.json"))).toEqual(
      buildPhase0SmallFixture(),
    );
    expect(readJson(path.join(FIXTURES_DIR, "medium.project.json"))).toEqual(
      buildPhase0MediumFixture(),
    );
    expect(readJson(path.join(FIXTURES_DIR, "large.project.json"))).toEqual(
      buildPhase0LargeFixture(),
    );
  });
});

describe("Vite Phase 0 command goldens", () => {
  it("committed *.after.json match deterministic command outputs", () => {
    const goldens = buildPhase0Goldens();
    for (const [name, snapshot] of Object.entries(goldens)) {
      const filePath = path.join(GOLDENS_DIR, `${name}.after.json`);
      expect(fs.existsSync(filePath), `missing golden ${name}`).toBe(true);
      expect(readJson(filePath)).toEqual(snapshot);
    }
  });
});
