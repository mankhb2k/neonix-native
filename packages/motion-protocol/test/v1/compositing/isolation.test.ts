import { describe, expect, it } from "vitest";
import { IsolationSchema } from "../../../src/v1/compositing/isolation";

describe("IsolationSchema", () => {
  it("maps isolate vs auto", () => {
    expect(IsolationSchema.parse("auto")).toBe("auto");
    expect(IsolationSchema.parse("isolate")).toBe("isolate");
    expect(IsolationSchema.safeParse("pass-through").success).toBe(false);
  });
});
