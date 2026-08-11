/**
 * Phase 4 guard — ensures the public root API exports zero V2-shaped names.
 *
 * Any PR that introduces `*V2Schema`, `*V2` type/schema, or V2-specific
 * authoring types (MotionProjectV2, MotionComponentV2, etc.) from the root
 * barrel will cause this test to fail.
 */
import { describe, expect, test } from "vitest";

describe("root API — no V2-shaped exports", () => {
  test("no *V2Schema exports", async () => {
    const mod = await import("../index");
    const exported = new Set(Object.keys(mod));
    const v2SchemaExports = [...exported].filter(
      (k) => k.endsWith("V2Schema") || k.endsWith("V2"),
    );
    expect(v2SchemaExports).toEqual([]);
  });

  test("no V2-suffixed type exports", async () => {
    // Dynamic import is for values-only; types are not enumerable via keys.
    // We rely on the gate (validate-v3-source-of-truth) for type-level checks.
    // This test guards runtime-visible exports only.
    const mod = await import("../index");
    const exported = new Set(Object.keys(mod));
    const forbidden = [
      "MotionProjectV2",
      "MotionComponentV2",
      "NormalizedMotionProjectV2",
      "parseMotionProjectV2",
      "parseMotionComponentV2",
      "serializeMotionProjectV2",
      "MotionRuntimeIR",
    ];
    const present = forbidden.filter((k) => exported.has(k));
    expect(present).toEqual([]);
  });
});
