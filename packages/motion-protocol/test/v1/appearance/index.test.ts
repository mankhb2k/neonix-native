import { describe, expect, it } from "vitest";
import { AppearanceSchema } from "../../../src/v1/appearance/index";

describe("AppearanceSchema", () => {
  it("defaults to visible at full opacity", () => {
    expect(AppearanceSchema.parse({})).toEqual({ visible: true, opacity: 100 });
  });

  it("rejects extra appearance keys including hit-test", () => {
    expect(AppearanceSchema.safeParse({ hitTest: true }).success).toBe(false);
    expect(AppearanceSchema.safeParse({ pointerEvents: "none" }).success).toBe(
      false,
    );
  });
});
