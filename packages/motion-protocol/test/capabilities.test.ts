import { describe, expect, it } from "vitest";
import {
  KeyframeEasingSchema,
  LayerSchema,
  TransformSchema,
  isLayerPropertyBindable,
  isLayerPropertyAnimatable,
  motionPropertyCapability,
  publicMotionPropertyCapabilities,
} from "../src/index";
import { visualLayerAtoms } from "../src/v1/layer-atoms";

const ATOMS = visualLayerAtoms({ width: 10, height: 10 });

describe("motion-protocol R2–R5 contract", () => {
  it("accepts adjustment layers", () => {
    expect(
      LayerSchema.parse({
        id: "grade",
        type: "adjustment",
        parentLayerId: null,
        zIndex: 0,
        timing: { start: 0, duration: 1 },
        ...ATOMS,
        payload: { brightness: 110, contrast: 110, saturation: 100 },
      }).type,
    ).toBe("adjustment");
  });

  it("accepts transform.depth", () => {
    expect(TransformSchema.parse({ ...ATOMS.transform, depth: 1.5 }).depth).toBe(
      1.5,
    );
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
    expect(isLayerPropertyBindable("text", "payload.text")).toBe(true);
    expect(isLayerPropertyBindable("text", "payload.notAField")).toBe(false);
    expect(isLayerPropertyBindable("text", "payload.counterProgress")).toBe(
      false,
    );
    expect(isLayerPropertyBindable("component", "payload.props.title")).toBe(
      false,
    );
    expect(isLayerPropertyBindable("group", "transform.depth")).toBe(true);
    expect(isLayerPropertyBindable("audio", "transform.depth")).toBe(false);
    expect(isLayerPropertyBindable("audio", "transform.translate.x")).toBe(
      false,
    );
    expect(isLayerPropertyBindable("audio", "appearance.opacity")).toBe(false);
    expect(isLayerPropertyBindable("audio", "appearance.visible")).toBe(false);
    expect(isLayerPropertyBindable("text", "appearance.opacity")).toBe(true);
    expect(isLayerPropertyBindable("text", "style.fill")).toBe(false);
    expect(isLayerPropertyBindable("text", "modifiers.mp.progress")).toBe(
      false,
    );
    expect(isLayerPropertyAnimatable("text", "modifiers.mp.progress")).toBe(
      false,
    );
    expect(
      motionPropertyCapability("text", "modifiers.mp.progress"),
    ).toBeUndefined();
    expect(
      publicMotionPropertyCapabilities("text").some((entry) =>
        entry.property.startsWith("modifiers."),
      ),
    ).toBe(false);
    expect(isLayerPropertyAnimatable("text", "frame.width")).toBe(false);
    expect(isLayerPropertyAnimatable("text", "transform.translate.x")).toBe(
      true,
    );
    expect(motionPropertyCapability("text", "effects.fx.radius")?.animatable).toBe(
      true,
    );
    expect(motionPropertyCapability("text", "effects.fx.color")?.animatable).toBe(
      false,
    );
    expect(
      motionPropertyCapability("text", "effects.fx.intensity"),
    ).toBeUndefined();
    expect(
      motionPropertyCapability("camera", "effects.fx.radius"),
    ).toBeUndefined();
    expect(
      motionPropertyCapability("audio", "effects.fx.radius"),
    ).toBeUndefined();
    expect(
      publicMotionPropertyCapabilities("text").some(
        (entry) => entry.property === "payload.text",
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
      zIndex: 0,
      timing: { start: 0, duration: 1 },
      ...visualLayerAtoms({
        width: 100,
        height: 100,
        originX: 0,
        originY: 0,
      }),
      payload: { color: "#111111" },
    });
    expect(node.type).toBe("solid");
  });
});
