/**
 * Compositing parity fixtures (group / layer / effects).
 */

import type { RenderSnapshot } from "../render-snapshot";
import { buildPaintCommandBuffer } from "../paint";
import type { PaintParityFixture } from "./paint-parity-fixtures";

const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } as const;

function make(
  id: string,
  label: string,
  items: RenderSnapshot["items"],
): PaintParityFixture {
  const snapshot: RenderSnapshot = {
    sceneId: id,
    frame: 0,
    time: 0,
    width: 320,
    height: 180,
    background: "#111",
    space: "flat-2d",
    projection: { kind: "orthographic" },
    cameraMatrix: { ...identity },
    items,
  };
  return { id, label, snapshot, buffer: buildPaintCommandBuffer(snapshot) };
}

export const FIXTURE_GROUP_PASSTHROUGH = make("group-pass", "Group pass-through", [
  {
    key: "group-pass:g",
    sceneId: "group-pass",
    nodeId: "g",
    nodeType: "group",
    worldMatrix: { ...identity },
    worldBounds: { x: 0, y: 0, width: 100, height: 100 },
    worldOpacity: 1,
    visible: true,
    selectable: false,
    locked: false,
    renderOrder: 0,
    payload: { kind: "group", width: 100, height: 100 },
    depth: 0,
    projectedOffset: { x: 0, y: 0 },
    compositing: {
      isolation: "pass-through",
      needsOffscreen: false,
      isAdjustment: false,
      groupCompositing: "pass-through",
      effectOrder: [],
    },
  },
  {
    key: "group-pass:child",
    sceneId: "group-pass",
    nodeId: "child",
    nodeType: "shape",
    worldMatrix: { ...identity, e: 10, f: 10 },
    worldBounds: { x: 10, y: 10, width: 40, height: 40 },
    worldOpacity: 1,
    visible: true,
    selectable: true,
    locked: false,
    renderOrder: 1,
    payload: {
      kind: "shape",
      shape: "rectangle",
      fill: "#fbbf24",
      width: 40,
      height: 40,
    },
    depth: 0,
    projectedOffset: { x: 0, y: 0 },
  },
]);

export const FIXTURE_BLUR_LAYER = make("blur-layer", "Blur isolation layer", [
  {
    key: "blur-layer:s",
    sceneId: "blur-layer",
    nodeId: "s",
    nodeType: "shape",
    worldMatrix: { ...identity, e: 20, f: 20 },
    worldBounds: { x: 20, y: 20, width: 80, height: 80 },
    worldOpacity: 1,
    visible: true,
    selectable: true,
    locked: false,
    renderOrder: 0,
    payload: {
      kind: "shape",
      shape: "ellipse",
      fill: "#38bdf8",
      width: 80,
      height: 80,
    },
    depth: 0,
    projectedOffset: { x: 0, y: 0 },
    effects: [{ id: "fx.blur", type: "blur", radius: 6 }],
    compositing: {
      isolation: "isolate",
      needsOffscreen: true,
      isAdjustment: false,
      effectOrder: [{ id: "fx.blur", type: "blur" }],
    },
  },
]);

export const FIXTURE_MASK_LAYER = make("mask-layer", "Mask layer metadata", [
  {
    key: "mask-layer:s",
    sceneId: "mask-layer",
    nodeId: "s",
    nodeType: "shape",
    worldMatrix: { ...identity, e: 0, f: 0 },
    worldBounds: { x: 0, y: 0, width: 100, height: 100 },
    worldOpacity: 1,
    visible: true,
    selectable: true,
    locked: false,
    renderOrder: 0,
    payload: {
      kind: "shape",
      shape: "rectangle",
      fill: "#ef4444",
      width: 100,
      height: 100,
    },
    depth: 0,
    projectedOffset: { x: 0, y: 0 },
    compositing: {
      isolation: "isolate",
      needsOffscreen: true,
      isAdjustment: false,
      mask: {
        mode: "alpha",
        sourceNodeId: "maskSrc",
        sourceVisibility: "mask-only",
      },
      effectOrder: [],
    },
  },
]);

export const COMPOSITING_PARITY_FIXTURES = [
  FIXTURE_GROUP_PASSTHROUGH,
  FIXTURE_BLUR_LAYER,
  FIXTURE_MASK_LAYER,
] as const;
