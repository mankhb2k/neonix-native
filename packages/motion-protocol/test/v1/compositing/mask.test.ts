import { describe, expect, it } from "vitest";
import { LayerMaskSchema } from "../../../src/v1/compositing/mask";

describe("LayerMaskSchema", () => {
  it("keeps clip source-visibility", () => {
    expect(
      LayerMaskSchema.parse({
        sourceLayerId: "mask-shape",
        mode: "clip",
        "source-visibility": "mask-only",
      }),
    ).toEqual({
      sourceLayerId: "mask-shape",
      mode: "clip",
      "source-visibility": "mask-only",
    });
  });

  it("allows luma in the enum", () => {
    expect(
      LayerMaskSchema.parse({
        sourceLayerId: "a",
        mode: "luma",
        "source-visibility": "content-and-mask",
      }).mode,
    ).toBe("luma");
  });

  it("rejects missing source-visibility", () => {
    expect(
      LayerMaskSchema.safeParse({
        sourceLayerId: "a",
        mode: "clip",
      }).success,
    ).toBe(false);
  });

  it("rejects camelCase sourceVisibility", () => {
    expect(
      LayerMaskSchema.safeParse({
        sourceLayerId: "a",
        mode: "clip",
        sourceVisibility: "mask-only",
      }).success,
    ).toBe(false);
  });
});
