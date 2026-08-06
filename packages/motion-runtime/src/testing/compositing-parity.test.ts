import { describe, expect, it } from "vitest";
import { compositingFingerprint } from "../compositing-fingerprint";
import { COMPOSITING_PARITY_FIXTURES } from "./compositing-parity-fixtures";

describe("compositing parity fixtures", () => {
  it("blur layer emits beginLayer scope", () => {
    const fx = COMPOSITING_PARITY_FIXTURES.find((f) => f.id === "blur-layer")!;
    const fp = compositingFingerprint(fx.buffer);
    expect(fp.layers).toBeGreaterThanOrEqual(1);
    expect(fp.effectDrawables).toBeGreaterThanOrEqual(1);
  });

  it("mask layer records mask metadata", () => {
    const fx = COMPOSITING_PARITY_FIXTURES.find((f) => f.id === "mask-layer")!;
    const fp = compositingFingerprint(fx.buffer);
    expect(fp.masks).toBe(1);
  });

  it("group pass-through keeps drawables", () => {
    const fx = COMPOSITING_PARITY_FIXTURES.find((f) => f.id === "group-pass")!;
    const fp = compositingFingerprint(fx.buffer);
    expect(fp.groups).toBeGreaterThanOrEqual(1);
    expect(fp.drawables).toBeGreaterThanOrEqual(1);
  });
});
