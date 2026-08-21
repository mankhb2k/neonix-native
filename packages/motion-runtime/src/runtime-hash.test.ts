import { describe, expect, it } from "vitest";
import { computeRuntimeHash } from "./runtime-hash";

describe("runtime hash", () => {
  it("uses SHA-256 over canonical JSON", () => {
    expect(computeRuntimeHash({})).toBe("44136fa355b3678a1146ad16f7e8649e");
  });

  it("is stable across object key order and ignores runtimeHash", () => {
    const left = { format: "motion-runtime", nodes: [], composition: { fps: 30 } };
    const right = { composition: { fps: 30 }, nodes: [], format: "motion-runtime", runtimeHash: "old" };
    expect(computeRuntimeHash(left)).toBe(computeRuntimeHash(right));
    expect(computeRuntimeHash(left)).toMatch(/^[0-9a-f]{32}$/);
  });
});
