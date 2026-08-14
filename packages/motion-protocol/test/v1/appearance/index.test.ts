import { describe, expect, it } from "vitest";
import { AppearanceSchema } from "../../../src/v1/appearance/index";

describe("AppearanceSchema", () => {
  it("defaults to visible at full opacity", () => {
    expect(AppearanceSchema.parse({})).toEqual({ visible: true, opacity: 100 });
  });

  it("rejects blend-mode on appearance", () => {
    expect(AppearanceSchema.safeParse({ "blend-mode": "multiply" }).success).toBe(
      false,
    );
  });
});
