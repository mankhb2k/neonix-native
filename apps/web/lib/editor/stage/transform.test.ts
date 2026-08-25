import { describe, expect, it } from "vitest";
import { createV2EditorProject } from "../document/demo-projects";
import {
  getSelectionBounds,
  buildV2MovePatches,
  buildV2ResizePatch,
  buildV2RotatePatch,
  getV2LayerBounds,
  getV2LayerSelectionBox,
  getV2LayerWorldQuad,
  isPointInsideV2Layer,
  isV2LayerActiveAtTime,
  isV2VisualLayer,
} from "./transform";

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

  it("creates V2 visual layers with a centered default anchor", () => {
    const shape = createV2EditorProject("shape").layers[0]!;
    expect(shape.transform.anchor).toMatchObject({
      x: shape.frame.width / 2,
      y: shape.frame.height / 2,
    });
    const history = createV2EditorProject("three-kingdoms");
    for (const layer of history.layers) {
      expect(layer.transform.anchor).toMatchObject({
        x: layer.frame.width / 2,
        y: layer.frame.height / 2,
      });
    }
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

  it("keeps the visible selection frame at frame size after rotation", () => {
    const project = createV2EditorProject("shape");
    const layer = {
      ...project.layers[0]!,
      frame: { width: 100, height: 60 },
      transform: {
        ...project.layers[0]!.transform,
        translate: { x: 200, y: 100, z: 0 },
        anchor: { x: 50, y: 30, z: 0 },
        rotate: { x: 0, y: 0, z: 30 },
      },
    };
    expect(getV2LayerBounds(layer).width).toBeGreaterThan(100);
    expect(getV2LayerSelectionBox(layer)).toMatchObject({
      x: 200,
      y: 100,
      width: 100,
      height: 60,
      rotation: 30,
      transformOriginX: 50,
      transformOriginY: 30,
    });
  });

  it("does not treat the transparent corners of a rotated layer AABB as hits", () => {
    const project = createV2EditorProject("shape");
    const layer = {
      ...project.layers[0]!,
      frame: { width: 100, height: 60 },
      transform: {
        ...project.layers[0]!.transform,
        translate: { x: 200, y: 100, z: 0 },
        anchor: { x: 50, y: 30, z: 0 },
        rotate: { x: 0, y: 0, z: 30 },
      },
    };
    const bounds = getV2LayerBounds(layer);
    expect(isPointInsideV2Layer(layer, { x: bounds.x + 1, y: bounds.y + 1 })).toBe(false);
    expect(isPointInsideV2Layer(layer, { x: 250, y: 130 })).toBe(true);
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

  it("maps a resize preview to frame and translate fields", () => {
    expect(buildV2ResizePatch({ x: 120, y: 80, width: 640, height: 360 })).toEqual({
      frame: { width: 640, height: 360 },
      transform: { translate: { x: 120, y: 80 } },
    });
  });

  it("clamps invalid resize values before creating a protocol patch", () => {
    expect(
      buildV2ResizePatch({ x: Number.NaN, y: Number.POSITIVE_INFINITY, width: -4, height: Number.NaN }),
    ).toEqual({
      frame: { width: 0.001, height: 0.001 },
      transform: { translate: { x: 0, y: 0 } },
    });
  });

  it("maps a rotation preview to the V2 rotate field", () => {
    expect(buildV2RotatePatch({ rotation: 45 })).toEqual({ transform: { rotate: { z: 45 } } });
  });

  it("uses a changed anchor as the visible rotation origin", () => {
    const project = createV2EditorProject("shape");
    const layer = {
      ...project.layers[0]!,
      frame: { width: 100, height: 60 },
      transform: {
        ...project.layers[0]!.transform,
        translate: { x: 200, y: 100, z: 0 },
        anchor: { x: 0, y: 0, z: 0 },
        rotate: { x: 0, y: 0, z: 30 },
      },
    };
    expect(getV2LayerSelectionBox(layer)).toMatchObject({
      x: 200,
      y: 100,
      transformOriginX: 0,
      transformOriginY: 0,
    });
  });
});
