import { describe, expect, it } from "vitest";
import { BlendModeSchema } from "../../../src/v1/compositing/blend-mode";

describe("BlendModeSchema", () => {
  it("accepts the shipped modes", () => {
    expect(BlendModeSchema.parse("normal")).toBe("normal");
    expect(BlendModeSchema.parse("multiply")).toBe("multiply");
  });

  it("rejects unknown modes", () => {
    expect(BlendModeSchema.safeParse("xor").success).toBe(false);
  });
});
