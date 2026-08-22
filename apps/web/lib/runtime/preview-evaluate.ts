import {
  evaluateRuntimeProjectV2,
  frameIndexAtTime,
  type Matrix4,
  type RuntimeNodeV2,
  type RuntimeProjectV2,
  type RuntimeShapeV2,
} from "@motionvideo/motion-runtime";

/**
 * V2 compatibility data for the frozen DOM editor. The certified preview path
 * is `PreviewStage`; this adapter must never reintroduce the V1 scene graph.
 */
export type PreviewParityNode = {
  id: string;
  type: "shape";
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
  worldMatrix: Matrix4;
  worldBounds: { x: number; y: number; width: number; height: number };
};

export type PreviewParitySnapshot = {
  graphId: string;
  time: number;
  layers: PreviewParityNode[];
};

/** @deprecated Frozen DOM preview only. Certified V2 preview uses Canvas backends. */
export function matrixToCss(matrix: Matrix4): string {
  return `matrix3d(${Array.from(matrix).join(", ")})`;
}

/**
 * Evaluate only the certified Runtime V2 document model. The output retains
 * the old DOM adapter shape so the frozen editor cannot pull V1 APIs back in.
 */
export function previewParitySnapshot(
  runtime: RuntimeProjectV2,
  graphId: string | undefined,
  time: number,
): PreviewParitySnapshot {
  const frame = frameIndexAtTime(Math.max(0, time), runtime.composition.fps);
  evaluateRuntimeProjectV2(runtime, frame, { time });

  return {
    graphId: graphId ?? runtime.composition.graphId,
    time,
    layers: runtime.nodes
      .filter(
        (node): node is RuntimeNodeV2 & { content: RuntimeShapeV2 } =>
          node.visible &&
          node.opacity > 0 &&
          node.content.kind === "shape" &&
          time >= node.timing.start &&
          time < node.timing.start + node.timing.duration,
      )
      .map((node) => {
        const x = node.worldMatrix[12] ?? 0;
        const y = node.worldMatrix[13] ?? 0;
        return {
          id: node.id,
          type: node.content.kind,
          visible: node.visible,
          worldOpacity: node.opacity,
          transform: {
            x,
            y,
            width: node.content.width,
            height: node.content.height,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            opacity: node.opacity,
            flipX: false,
            flipY: false,
          },
          worldOrigin: { x, y },
          worldMatrix: node.worldMatrix,
          worldBounds: {
            x,
            y,
            width: node.content.width,
            height: node.content.height,
          },
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
