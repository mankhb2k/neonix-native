import { describe, expect, it } from "vitest";
import {
  ExtrapolationBehaviorSchema,
  NodeV2Schema,
  TransformV2Schema,
  motionPropertyCapability,
  parseMotionComponentV2,
  publicMotionPropertyCapabilities,
} from "../src/index";

const baseTransform = {
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  anchorX: 0.5,
  anchorY: 0.5,
  opacity: 1,
  visible: true,
  flipX: false,
  flipY: false,
};

describe("motion-schema R0 contract truth", () => {
  it("rejects unknown node types", () => {
    expect(() =>
      NodeV2Schema.parse({
        id: "x",
        type: "adjustment",
        parentId: null,
        transform: baseTransform,
      }),
    ).toThrow();
  });

  it("does not accept transform.depth", () => {
    expect(() => TransformV2Schema.parse({ ...baseTransform, depth: 1 })).toThrow();
  });

  it("accepts cycle pingpong mode and rejects unknown modes", () => {
    expect(ExtrapolationBehaviorSchema.parse({ type: "cycle", mode: "pingpong" })).toEqual({
      type: "cycle",
      mode: "pingpong",
    });
    expect(() => ExtrapolationBehaviorSchema.parse({ type: "cycle", mode: "bounce" })).toThrow();
  });

  it("keeps transform.depth out of public AI vocabulary", () => {
    expect(motionPropertyCapability("group", "transform.depth")).toBeUndefined();
    expect(publicMotionPropertyCapabilities("text").some((entry) => entry.property === "transform.depth")).toBe(false);
  });

  it("does not expose adjustment payload vocabulary", () => {
    expect(publicMotionPropertyCapabilities("adjustment").every((entry) => entry.property.startsWith("transform."))).toBe(true);
  });

  it("parses solid nodes", () => {
    const component = parseMotionComponentV2({
      format: "motion-component",
      formatVersion: 2,
      componentId: "test.solid",
      componentVersion: "1.0.0",
      metadata: { name: "solid" },
      assets: [],
      variables: [],
      publicAPI: [],
      nodes: [
        {
          id: "plate",
          type: "solid",
          parentId: null,
          transform: { ...baseTransform, width: 100, height: 100, anchorX: 0, anchorY: 0 },
          payload: { width: 100, height: 100, color: "#111111" },
        },
      ],
      bindings: [],
      clips: [],
    });
    expect(component.nodes[0]?.type).toBe("solid");
  });
});
