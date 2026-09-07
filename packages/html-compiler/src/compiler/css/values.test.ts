import { describe, expect, it } from "vitest";
import { calcExpression, resolveVar } from "./values";

describe("CSS values domain", () => {
  it("resolves viewport units and nested custom-property fallbacks", () => {
    expect(calcExpression("50vw", "width", 0, 16, 16, { width: 1920, height: 1080 })).toEqual({ value: 960, unit: "px" });
    expect(resolveVar("var(--missing, var(--fallback, #fff))", new Map([["--fallback", "#0af"]]), new Set())).toBe("#0af");
  });
});
