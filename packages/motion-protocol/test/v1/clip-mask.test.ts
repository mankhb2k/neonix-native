import { describe, expect, it } from "vitest";
import { visualLayerAtoms } from "@motionvideo/patterns";
import { parseMotionProjectV1 } from "../../src/v1/parse";
import { MotionV1ReferenceError } from "../../src/v1/references/types";
import {
  CLIP_MASK_TARGET_KINDS,
  clipMaskTargetProject,
  clipMaskGroupIsolationProject,
  clipMaskChildIsolationProject,
  clipMaskComponentInternalProject,
} from "../../../patterns/src/__fixtures__/masks/clip-mask-projects";

describe("clip mask fixtures", () => {
  for (const kind of CLIP_MASK_TARGET_KINDS) {
    it(`parses clip-mask target ${kind}`, () => {
      const project = parseMotionProjectV1(clipMaskTargetProject(kind));
      expect(project.composition.width).toBe(400);
      const artwork = project.layers.find((layer) => layer.id === "artwork");
      expect(
        artwork && "compositing" in artwork && artwork.compositing?.mask?.mode,
      ).toBe("clip");
    });
  }

  it("parses group and child isolation fixtures", () => {
    expect(
      parseMotionProjectV1(clipMaskGroupIsolationProject()).layers,
    ).toHaveLength(3);
    expect(
      parseMotionProjectV1(clipMaskChildIsolationProject()).layers,
    ).toHaveLength(1);
    expect(
      parseMotionProjectV1(clipMaskComponentInternalProject()).components,
    ).toHaveLength(1);
  });

  it("rejects unknown mask source", () => {
    const raw = clipMaskTargetProject("solid") as Record<string, unknown>;
    const layers = raw.layers as Array<Record<string, unknown>>;
    const artwork = layers.find((layer) => layer.id === "artwork")!;
    artwork.compositing = {
      mask: {
        sourceLayerId: "missing",
        mode: "clip",
        "source-visibility": "mask-only",
      },
    };
    expect(() => parseMotionProjectV1(raw)).toThrow(MotionV1ReferenceError);
  });

  it("rejects self-mask", () => {
    const raw = clipMaskTargetProject("solid") as Record<string, unknown>;
    const layers = raw.layers as Array<Record<string, unknown>>;
    const artwork = layers.find((layer) => layer.id === "artwork")!;
    artwork.compositing = {
      mask: {
        sourceLayerId: "artwork",
        mode: "clip",
        "source-visibility": "mask-only",
      },
    };
    expect(() => parseMotionProjectV1(raw)).toThrow(MotionV1ReferenceError);
  });

  it("rejects image as clip source", () => {
    const raw = clipMaskTargetProject("solid") as Record<string, unknown>;
    const layers = raw.layers as Array<Record<string, unknown>>;
    layers.push({
      id: "photo",
      type: "image",
      parentLayerId: null,
      zIndex: 3,
      ...visualLayerAtoms({
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        originX: 0,
        originY: 0,
      }),
      payload: { assetId: "art-asset" },
      timing: { start: 0, duration: 1 },
    });
    raw.assets = [
      {
        id: "art-asset",
        assetType: "image",
        mimeType: "image/png",
        uri: "data:image/png;base64,aa",
        width: 10,
        height: 10,
      },
    ];
    const artwork = layers.find((layer) => layer.id === "artwork")!;
    artwork.compositing = {
      mask: {
        sourceLayerId: "photo",
        mode: "clip",
        "source-visibility": "mask-only",
      },
    };
    expect(() => parseMotionProjectV1(raw)).toThrow(MotionV1ReferenceError);
  });
});
