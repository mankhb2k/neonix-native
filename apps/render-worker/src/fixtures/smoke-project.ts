import {
  createV2OverlapProject,
  createV2ShapeProject,
} from "@motionvideo/motion-compiler/testing";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

/** Certified V2 fixture used by render-worker smoke tests and benchmarks. */
export function createSmokeProtocolV2(idSuffix?: string): MotionProtocolV2 {
  const id = idSuffix ? `smoke-${idSuffix}` : `smoke-${Date.now()}`;
  const overlap = createV2OverlapProject(id);
  return {
    ...overlap,
    layers: [
      ...overlap.layers,
      {
        ...createV2ShapeProject({
          id: `${id}-ellipse`,
          shape: "ellipse",
          frameWidth: 360,
          frameHeight: 240,
          transform: {
            translate: { x: 840, y: 420, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            rotate: { x: 0, y: 0, z: 0 },
            skew: { x: 0, y: 0 },
            anchor: { x: 0, y: 0, z: 0 },
          },
          fill: "#FFD166",
          zIndex: 2,
        }).layers[0]!,
      },
    ],
  };
}
