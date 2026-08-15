import { describe, expect, it } from "vitest";
import { CompositingSchema } from "../../../src/v1/compositing/index";

describe("CompositingSchema", () => {
  it("defaults blend and isolation", () => {
    expect(CompositingSchema.parse({})).toEqual({
      "blend-mode": "normal",
      isolation: "auto",
    });
  });

  it("rejects opacity on compositing", () => {
    expect(CompositingSchema.safeParse({ opacity: 0.5 }).success).toBe(false);
  });
});
