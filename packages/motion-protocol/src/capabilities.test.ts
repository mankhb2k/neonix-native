import { describe, expect, it } from "vitest";
import {
  ExtrapolationBehaviorSchema,
  KeyframeEasingSchema,
  LayerSchema,
  TransformSchema,
  isLayerPropertyBindable,
  motionPropertyCapability,
  publicMotionPropertyCapabilities,
} from "./index";

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

describe("motion-protocol R2–R5 contract", () => {
  it("accepts adjustment layers", () => {
    expect(
      LayerSchema.parse({
        id: "grade",
        type: "adjustment",
        parentLayerId: null,
        transform: baseTransform,
        payload: { brightness: 0.1, contrast: 1.1, saturation: 1 },
      }).type,
    ).toBe("adjustment");
  });

  it("accepts transform.depth", () => {
    expect(TransformSchema.parse({ ...baseTransform, depth: 1.5 }).depth).toBe(
      1.5,
    );
  });

  it("accepts cycle pingpong mode and rejects unknown modes", () => {
    expect(
      ExtrapolationBehaviorSchema.parse({ type: "cycle", mode: "pingpong" }),
    ).toEqual({
      type: "cycle",
      mode: "pingpong",
    });
    expect(() =>
      ExtrapolationBehaviorSchema.parse({ type: "cycle", mode: "bounce" }),
    ).toThrow();
  });

  it("exposes transform.depth in public AI vocabulary", () => {
    expect(motionPropertyCapability("group", "transform.depth")?.public).toBe(
      true,
    );
    expect(
      publicMotionPropertyCapabilities("text").some(
        (entry) => entry.property === "transform.depth",
      ),
    ).toBe(true);
  });

  it("exposes adjustment payload vocabulary", () => {
    expect(
      publicMotionPropertyCapabilities("adjustment").some(
        (entry) => entry.property === "payload.brightness",
      ),
    ).toBe(true);
  });

  it("treats capability bindable as the binding allowlist", () => {
    expect(isLayerPropertyBindable("text", "payload.content.text")).toBe(true);
    expect(isLayerPropertyBindable("text", "payload.notAField")).toBe(false);
    expect(isLayerPropertyBindable("text", "payload.counterProgress")).toBe(
      false,
    );
    expect(isLayerPropertyBindable("component", "payload.props.title")).toBe(
      false,
    );
    expect(isLayerPropertyBindable("group", "transform.z")).toBe(true);
    expect(
      publicMotionPropertyCapabilities("text").some(
        (entry) => entry.property === "payload.content.text",
      ),
    ).toBe(true);
  });

  it("accepts cubic-bezier and spring easing objects", () => {
    expect(
      KeyframeEasingSchema.parse({
        type: "cubic-bezier",
        x1: 0.42,
        y1: 0,
        x2: 0.58,
        y2: 1,
      }),
    ).toMatchObject({ type: "cubic-bezier" });
    expect(
      KeyframeEasingSchema.parse({
        type: "spring",
        stiffness: 180,
        damping: 12,
      }),
    ).toMatchObject({
      type: "spring",
    });
    expect(() =>
      KeyframeEasingSchema.parse({
        type: "cubic-bezier",
        x1: 2,
        y1: 0,
        x2: 0,
        y2: 1,
      }),
    ).toThrow();
  });

  it("parses solid layers via V1 LayerSchema", () => {
    const node = LayerSchema.parse({
      id: "plate",
      type: "solid",
      parentLayerId: null,
      transform: {
        ...baseTransform,
        width: 100,
        height: 100,
        anchorX: 0,
        anchorY: 0,
      },
      payload: { width: 100, height: 100, color: "#111111" },
    });
    expect(node.type).toBe("solid");
  });
});
