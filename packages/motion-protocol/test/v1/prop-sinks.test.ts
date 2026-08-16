import { describe, expect, it } from "vitest";
import { isOwnerPropSink } from "../../src/v1/prop-sinks";

describe("V1 owner color sinks", () => {
  it("routes color by layer type", () => {
    expect(isOwnerPropSink("color", "payload.color", "text")).toBe(true);
    expect(isOwnerPropSink("color", "payload.color", "solid")).toBe(true);
    expect(isOwnerPropSink("color", "style.fill", "text")).toBe(false);

    expect(isOwnerPropSink("color", "style.fill", "shape")).toBe(true);
    expect(isOwnerPropSink("color", "style.stroke", "path")).toBe(true);
    expect(isOwnerPropSink("color", "payload.color", "shape")).toBe(false);
    expect(isOwnerPropSink("color", "payload.color", "path")).toBe(false);

    expect(isOwnerPropSink("color", "style.fill", "svg")).toBe(true);
    expect(isOwnerPropSink("color", "style.stroke", "svg")).toBe(false);
    expect(isOwnerPropSink("color", "payload.color", "svg")).toBe(false);

    expect(isOwnerPropSink("color", "style.fill", "image")).toBe(false);
    expect(isOwnerPropSink("color", "payload.color", "video")).toBe(false);
  });
});
