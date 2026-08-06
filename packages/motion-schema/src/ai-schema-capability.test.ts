import { describe, expect, it } from "vitest";
import {
  AI_SCHEMA_CAPABILITY_MATRIX,
  AI_SCHEMA_CAPABILITY_VERSION,
  aiSchemaCapabilityReady,
  listAiSchemaProductionCapabilities,
} from "./ai-schema-capability";
import { MOTION_V2_LIMITS } from "./capabilities";
import { SourceRefSchema, sourceRefKey } from "./v2/source-ref";

describe("Phase 0 AI schema expansion foundation", () => {
  it("exposes new MOTION_V2_LIMITS for expansion phases", () => {
    expect(MOTION_V2_LIMITS.richTextRuns).toBeGreaterThan(0);
    expect(MOTION_V2_LIMITS.captionTokensPerTrack).toBeGreaterThan(0);
    expect(MOTION_V2_LIMITS.audioBeatsPerAsset).toBeGreaterThan(0);
    expect(MOTION_V2_LIMITS.presetDistance).toBeGreaterThan(0);
  });

  it("locks SourceRef shape for click-to-edit", () => {
    const ref = SourceRefSchema.parse({
      kind: "text-run",
      nodeId: "n1",
      runId: "r1",
    });
    expect(sourceRefKey(ref)).toBe("text-run:n1:r1");
    expect(() =>
      SourceRefSchema.parse({ kind: "caption-token", captionTrackId: "c1" }),
    ).toThrow();
  });

  it("records baseline E2E capabilities without guessing coverage %", () => {
    expect(AI_SCHEMA_CAPABILITY_VERSION).toBe("ai-schema.0");
    const ready = listAiSchemaProductionCapabilities();
    expect(ready.some((r) => r.id === "baseline.hard-cut")).toBe(true);
    expect(ready.some((r) => r.id === "baseline.entrance-preset")).toBe(true);
    expect(
      AI_SCHEMA_CAPABILITY_MATRIX.filter((r) => r.phase > 0).every(
        (r) => !aiSchemaCapabilityReady(r),
      ),
    ).toBe(true);
  });
});
