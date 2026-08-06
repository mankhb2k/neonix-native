/**
 * MVP paint parity fixtures — shared structural slices for Pixi/Remotion.
 */

import type { PaintCommandBuffer } from "../paint";
import { PAINT_COMMAND_VERSION } from "../paint";
import type { RenderSnapshot } from "../render-snapshot";
import { buildPaintCommandBuffer } from "../paint";

const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } as const;

function baseSnapshot(
  items: RenderSnapshot["items"],
  id = "parity",
): RenderSnapshot {
  return {
    sceneId: id,
    frame: 0,
    time: 0,
    width: 320,
    height: 180,
    background: "#f5f5f5",
    space: "flat-2d",
    projection: { kind: "orthographic" },
    cameraMatrix: { ...identity },
    items,
  };
}

export type PaintParityFixture = {
  id: string;
  label: string;
  snapshot: RenderSnapshot;
  buffer: PaintCommandBuffer;
};

function fixture(
  id: string,
  label: string,
  items: RenderSnapshot["items"],
): PaintParityFixture {
  const snapshot = baseSnapshot(items, id);
  return {
    id,
    label,
    snapshot,
    buffer: buildPaintCommandBuffer(snapshot),
  };
}

/** Affine / skew rectangle. */
export const FIXTURE_AFFINE_SKEW = fixture("affine-skew", "Affine skew", [
  {
    key: "affine-skew:shape",
    sceneId: "affine-skew",
    nodeId: "shape",
    nodeType: "shape",
    worldMatrix: { a: 1, b: 0.2, c: 0.1, d: 1, e: 40, f: 30 },
    worldBounds: { x: 40, y: 30, width: 80, height: 40 },
    worldOpacity: 1,
    visible: true,
    selectable: true,
    locked: false,
    renderOrder: 0,
    payload: {
      kind: "shape",
      shape: "rectangle",
      fill: "#2563eb",
      width: 80,
      height: 40,
    },
    depth: 0,
    projectedOffset: { x: 0, y: 0 },
  },
]);

export const FIXTURE_TEXT = fixture("text-basic", "Text", [
  {
    key: "text-basic:t",
    sceneId: "text-basic",
    nodeId: "t",
    nodeType: "text",
    worldMatrix: { ...identity, e: 16, f: 24 },
    worldBounds: { x: 16, y: 24, width: 200, height: 40 },
    worldOpacity: 1,
    visible: true,
    selectable: true,
    locked: false,
    renderOrder: 0,
    payload: {
      kind: "text",
      text: "Parity",
      fontSize: 28,
      fontWeight: 700,
      align: "left",
      fill: "#111827",
    },
    depth: 0,
    projectedOffset: { x: 0, y: 0 },
  },
]);

export const FIXTURE_GRADIENT = fixture("gradient-fill", "Gradient", [
  {
    key: "gradient-fill:s",
    sceneId: "gradient-fill",
    nodeId: "s",
    nodeType: "shape",
    worldMatrix: { ...identity, e: 20, f: 20 },
    worldBounds: { x: 20, y: 20, width: 120, height: 80 },
    worldOpacity: 1,
    visible: true,
    selectable: true,
    locked: false,
    renderOrder: 0,
    payload: {
      kind: "shape",
      shape: "rectangle",
      fill: "#22c55e",
      fillPaint: {
        type: "linear-gradient",
        angle: 90,
        stops: [
          { offset: 0, color: "#22c55e" },
          { offset: 1, color: "#0ea5e9" },
        ],
      },
      width: 120,
      height: 80,
    },
    depth: 0,
    projectedOffset: { x: 0, y: 0 },
  },
]);

export const FIXTURE_PATH = fixture("path-stroke", "Path", [
  {
    key: "path-stroke:p",
    sceneId: "path-stroke",
    nodeId: "p",
    nodeType: "path",
    worldMatrix: { ...identity, e: 10, f: 10 },
    worldBounds: { x: 10, y: 10, width: 100, height: 80 },
    worldOpacity: 1,
    visible: true,
    selectable: true,
    locked: false,
    renderOrder: 0,
    payload: {
      kind: "path",
      contours: [
        {
          id: "c0",
          start: { x: 0, y: 0 },
          closed: false,
          segments: [
            { kind: "line", to: { x: 80, y: 0 } },
            {
              kind: "cubic",
              control1: { x: 100, y: 0 },
              control2: { x: 100, y: 60 },
              to: { x: 80, y: 60 },
            },
          ],
        },
      ],
      fillRule: "nonzero",
      stroke: "#dc2626",
      strokeWidth: 3,
    },
    depth: 0,
    projectedOffset: { x: 0, y: 0 },
  },
]);

export const FIXTURE_IMAGE = fixture("image-png", "PNG image", [
  {
    key: "image-png:i",
    sceneId: "image-png",
    nodeId: "i",
    nodeType: "image",
    worldMatrix: { ...identity, e: 8, f: 8 },
    worldBounds: { x: 8, y: 8, width: 64, height: 64 },
    worldOpacity: 1,
    visible: true,
    selectable: true,
    locked: false,
    renderOrder: 0,
    payload: {
      kind: "image",
      assetId: "img1",
      uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      width: 64,
      height: 64,
    },
    depth: 0,
    projectedOffset: { x: 0, y: 0 },
  },
]);

export const FIXTURE_POLYGON = fixture("polygon", "Polygon shape", [
  {
    key: "polygon:p",
    sceneId: "polygon",
    nodeId: "p",
    nodeType: "shape",
    worldMatrix: { ...identity, e: 50, f: 20 },
    worldBounds: { x: 50, y: 20, width: 60, height: 60 },
    worldOpacity: 1,
    visible: true,
    selectable: true,
    locked: false,
    renderOrder: 0,
    payload: {
      kind: "shape",
      shape: "polygon",
      fill: "#a855f7",
      width: 60,
      height: 60,
    },
    depth: 0,
    projectedOffset: { x: 0, y: 0 },
  },
]);

export const PAINT_PARITY_FIXTURES: readonly PaintParityFixture[] = [
  FIXTURE_AFFINE_SKEW,
  FIXTURE_TEXT,
  FIXTURE_GRADIENT,
  FIXTURE_PATH,
  FIXTURE_IMAGE,
  FIXTURE_POLYGON,
];

export function paintParityDrawKeys(buffer: PaintCommandBuffer): string[] {
  return buffer.commands
    .filter(
      (c) =>
        c.op === "drawText" ||
        c.op === "drawShape" ||
        c.op === "drawSolid" ||
        c.op === "drawImage" ||
        c.op === "drawPath" ||
        c.op === "drawVideo",
    )
    .map((c) => ("key" in c ? c.key : ""))
    .filter(Boolean)
    .sort();
}

export { PAINT_COMMAND_VERSION };
