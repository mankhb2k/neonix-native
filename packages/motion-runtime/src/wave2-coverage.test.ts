import { describe, expect, it } from "vitest";
import { evaluateFrame } from "./evaluated-frame";
import {
  CAPABILITY_MANIFEST_VERSION,
  WAVE2_CAPABILITY_LEDGER,
} from "./capability-ledger";
import { cameraViewMatrix } from "./camera-view";
import type { RuntimeScene } from "./evaluator";

function pathScene(): RuntimeScene {
  return {
    id: "scene.path",
    duration: 2,
    activeCameraLayerId: "cam",
    layers: [
      {
        id: "cam",
        type: "camera",
        parentLayerId: null,
        zIndex: 0,
        transform: {
          x: 100,
          y: 50,
          width: 1,
          height: 1,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          visible: true,
          anchorX: 0,
          anchorY: 0,
          flipX: false,
          flipY: false,
        },
        payload: { zoom: 1.5, projection: "orthographic", parallaxStrength: 1 },
      },
      {
        id: "stroke",
        type: "path",
        parentLayerId: null,
        zIndex: 1,
        transform: {
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          visible: true,
          anchorX: 0,
          anchorY: 0,
          flipX: false,
          flipY: false,
        },
        payload: {
          contours: [
            {
              id: "c1",
              start: { x: 10, y: 10 },
              closed: false,
              segments: [
                { kind: "line", to: { x: 180, y: 10 } },
                { kind: "cubic", control1: { x: 180, y: 40 }, control2: { x: 120, y: 80 }, to: { x: 60, y: 80 } },
              ],
            },
          ],
          fillRule: "nonzero",
        },
        style: { stroke: "#ffffff", strokeWidth: 4, fill: "#1877F2" },
        effects: [{ id: "fx.blur", type: "blur", radius: 2 }],
        modifiers: [
          {
            id: "trim",
            type: "trim-path",
            start: 0,
            end: 0.5,
            offset: 0,
          },
        ],
      },
    ],
    tracks: [],
  } as unknown as RuntimeScene;
}

describe("wave2 path + camera paint", () => {
  it("emits drawPath with trimmed contours and blur effects", () => {
    const frame = evaluateFrame({
      scene: pathScene(),
      frame: 0,
      time: 0,
      width: 200,
      height: 100,
      background: "#000",
    });
    const drawPath = frame.paint.commands.find((c) => c.op === "drawPath");
    expect(drawPath?.op).toBe("drawPath");
    if (drawPath?.op !== "drawPath") return;
    expect(drawPath.contours.length).toBeGreaterThan(0);
    expect(drawPath.stroke).toBe("#ffffff");
    expect(drawPath.effects?.[0]?.type).toBe("blur");
    expect(frame.interaction.cameraMatrix).not.toEqual({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: 0,
      f: 0,
    });
  });

  it("cameraViewMatrix matches worker ordering", () => {
    const m = cameraViewMatrix({ x: 100, y: 50, rotation: 0, zoom: 2 }, 200, 100);
    // Center then zoom then -camera: point (100,50) maps near canvas center.
    expect(m.a).toBeCloseTo(2);
    expect(m.d).toBeCloseTo(2);
  });

  it("bumps manifest for wave2 ledger rows", () => {
    expect(CAPABILITY_MANIFEST_VERSION).toBe("wave2.1");
    expect(WAVE2_CAPABILITY_LEDGER.some((r) => r.id === "primitive.path")).toBe(
      true,
    );
  });
});
