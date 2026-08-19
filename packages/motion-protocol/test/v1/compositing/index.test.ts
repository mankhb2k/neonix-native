import { describe, expect, it } from "vitest";
import { CompositingSchema } from "../../../src/v1/compositing/index";

describe("CompositingSchema", () => {
  it("defaults blend-mode only", () => {
    expect(CompositingSchema.parse({})).toEqual({
      "blend-mode": "normal",
    });
  });

  it("rejects isolation on compositing", () => {
    expect(
      CompositingSchema.safeParse({ isolation: "isolate" }).success,
    ).toBe(false);
  });

  it("rejects opacity on compositing", () => {
    expect(CompositingSchema.safeParse({ opacity: 0.5 }).success).toBe(false);
  });
});
