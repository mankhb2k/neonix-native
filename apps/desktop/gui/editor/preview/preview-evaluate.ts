import {
  applyMatrix,
  evaluateScene,
  layerGraphFromRuntime,
  type EvaluatedNode,
  type Matrix2D,
} from "@motionvideo/motion-runtime";
import type {
  MotionRuntimeProject,
} from "@motionvideo/motion-protocol/runtime";

export type PreviewParityNode = {
  id: string;
  type: string;
  visible: boolean;
  worldOpacity: number;
  transform: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    opacity: number;
    flipX: boolean;
    flipY: boolean;
  };
  worldOrigin: { x: number; y: number };
  worldMatrix: Matrix2D;
  worldBounds: EvaluatedNode["worldBounds"];
};

export type PreviewParitySnapshot = {
  graphId: string;
  time: number;
  layers: PreviewParityNode[];
};

export function matrixToCss(matrix: Matrix2D): string {
  return `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.e}, ${matrix.f})`;
}

export function previewParitySnapshot(
  runtime: MotionRuntimeProject,
  graphId: string | undefined,
  time: number,
): PreviewParitySnapshot {
  const scene = layerGraphFromRuntime(runtime);
  if (scene.layers.length === 0 && !(scene.duration > 0))
    throw new Error("Runtime preview requires at least one layer");
  const evaluated = evaluateScene(scene, time);
  return {
    graphId: scene.id,
    time,
    layers: evaluated.map((item) => {
      const worldOrigin = applyMatrix(item.worldMatrix, 0, 0);
      return {
        id: item.layer.id,
        type: item.layer.type,
        visible: item.visible,
        worldOpacity: item.worldOpacity,
        transform: {
          x: item.transform.x,
          y: item.transform.y,
          width: item.transform.width,
          height: item.transform.height,
          rotation: item.transform.rotation,
          scaleX: item.transform.scaleX,
          scaleY: item.transform.scaleY,
          opacity: item.transform.opacity,
          flipX: item.transform.flipX,
          flipY: item.transform.flipY,
        },
        worldOrigin,
        worldMatrix: item.worldMatrix,
        worldBounds: item.worldBounds,
      };
    }),
  };
}

export function stageSizeForAspect(aspectRatio: string): {
  width: number;
  height: number;
} {
  switch (aspectRatio) {
    case "16:9":
      return { width: 1920, height: 1080 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "9:16":
    default:
      return { width: 1080, height: 1920 };
  }
}
