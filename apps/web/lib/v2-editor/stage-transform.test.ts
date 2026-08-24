import { describe, expect, it } from "vitest";
import { createV2EditorProject } from "./projects";
import {
  getSelectionBounds,
  buildV2MovePatches,
  getV2LayerBounds,
  getV2LayerWorldQuad,
  isV2LayerActiveAtTime,
  isV2VisualLayer,
} from "./stage-transform";

describe("V2 stage transform geometry", () => {
  it("maps an untransformed frame from translate to composition bounds", () => {
    const project = createV2EditorProject("shape");
    const layer = {
      ...project.layers[0]!,
      frame: { width: 100, height: 60 },
      transform: {
        ...project.layers[0]!.transform,
        translate: { x: 40, y: 20, z: 0 },
      },
    };

    expect(getV2LayerBounds(layer)).toMatchObject({
      x: 40,
      y: 20,
      width: 100,
      height: 60,
      rotation: 0,
    });
  });

  it("keeps an anchored rotated frame around the same pivot", () => {
    const project = createV2EditorProject("shape");
    const layer = {
      ...project.layers[0]!,
      frame: { width: 100, height: 60 },
      transform: {
        ...project.layers[0]!.transform,
        translate: { x: 200, y: 100, z: 0 },
        anchor: { x: 50, y: 30, z: 0 },
        rotate: { x: 0, y: 0, z: 90 },
      },
    };
    const quad = getV2LayerWorldQuad(layer);
    expect(quad[0]).toEqual({ x: 280, y: 80 });
    expect(getV2LayerBounds(layer)).toMatchObject({
      x: 220,
      y: 80,
      width: 60,
      height: 100,
      rotation: 90,
    });
  });

  it("combines active visual layer bounds for a multi-selection", () => {
    const project = createV2EditorProject("shape");
    const first = project.layers[0]!;
    const second = {
      ...first,
      id: "second",
      transform: {
        ...first.transform,
        translate: { x: 300, y: 120, z: 0 },
      },
    };
    expect(getSelectionBounds([getV2LayerBounds(first), getV2LayerBounds(second)])).toMatchObject({
      x: 300,
      y: 120,
      width: 1140,
      height: 690,
      rotation: 0,
    });
  });

  it("identifies visual types and timing visibility", () => {
    const project = createV2EditorProject("shape");
    const layer = project.layers[0]!;
    expect(isV2VisualLayer(layer)).toBe(true);
    expect(isV2LayerActiveAtTime(layer, 0)).toBe(true);
    expect(isV2LayerActiveAtTime(layer, 3.001)).toBe(false);
  });

  it("builds one atomic translate patch per selected layer", () => {
    const project = createV2EditorProject("shape");
    const first = project.layers[0]!;
    const second = { ...first, id: "second" };
    expect(buildV2MovePatches([first, second], { x: 12, y: -8 })).toEqual({
      shape: { transform: { translate: { x: 492, y: 262 } } },
      second: { transform: { translate: { x: 492, y: 262 } } },
    });
  });
});
