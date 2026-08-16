import { describe, expect, it } from "vitest";
import {
  AI_SCHEMA_CAPABILITY_MATRIX,
  AI_SCHEMA_CAPABILITY_VERSION,
  aiSchemaCapabilityReady,
  listAiSchemaProductionCapabilities,
} from "../src/ai-schema-capability";
import { MOTION_PROTOCOL_LIMITS } from "../src/capabilities";
import { SourceRefSchema, sourceRefKey } from "../src/v1/source-ref";

describe("Phase 0 AI schema expansion foundation", () => {
  it("exposes new MOTION_PROTOCOL_LIMITS for expansion phases", () => {
    expect(MOTION_PROTOCOL_LIMITS.captionTokensPerTrack).toBeGreaterThan(0);
    expect(MOTION_PROTOCOL_LIMITS.captionTokensPerTrack).toBeGreaterThan(0);
    expect(MOTION_PROTOCOL_LIMITS.audioBeatsPerAsset).toBeGreaterThan(0);
    expect(MOTION_PROTOCOL_LIMITS.presetDistance).toBeGreaterThan(0);
  });

  it("locks SourceRef to layer / text-run", () => {
    const run = SourceRefSchema.parse({
      kind: "text-run",
      layerId: "headline",
      runId: "r1",
    });
    expect(sourceRefKey(run)).toBe("text-run:headline:r1");
    expect(
      sourceRefKey(SourceRefSchema.parse({ kind: "layer", layerId: "headline" })),
    ).toBe("layer:headline");
    expect(() =>
      SourceRefSchema.parse({ kind: "caption-token", captionTrackId: "c1" }),
    ).toThrow();
    expect(() =>
      SourceRefSchema.parse({ kind: "node", layerId: "headline" }),
    ).toThrow();
    expect(() => SourceRefSchema.parse({ kind: "clip", clipId: "c1" })).toThrow();
  });

  it("records capability matrix with production-ready rows", () => {
    expect(AI_SCHEMA_CAPABILITY_VERSION).toBe("ai-schema.3");
    const ready = listAiSchemaProductionCapabilities();
    expect(ready.some((r) => r.id === "baseline.hard-cut")).toBe(true);
    expect(ready.some((r) => r.id === "baseline.entrance-preset")).toBe(true);
    expect(ready.some((r) => r.id === "preset.timeline-end")).toBe(true);
    expect(ready.some((r) => r.id === "text.plain-single-style")).toBe(true);
    expect(ready.some((r) => r.id === "text.rich-runs")).toBe(false);
    expect(AI_SCHEMA_CAPABILITY_MATRIX.some((r) => r.id === "text.rich-runs")).toBe(
      false,
    );
    expect(
      aiSchemaCapabilityReady(
        AI_SCHEMA_CAPABILITY_MATRIX.find((r) => r.id === "caption.text-layers")!,
      ),
    ).toBe(false);
  });
});
