import { resolveStageTextResize } from "@/lib/editor/stage/text-resize-adapter";
import { buildTextScaleResizeUpdate } from "@/lib/editor/text/sizing";
import {
  buildStageTextResizeCommand,
  buildStageTransformCommand,
  type StageTransformValues,
} from "@motionvideo/editor-core/interactions/stage";
import type { EditorCommand } from "@motionvideo/editor-core";
import type { MotionProtocolV2, V2Layer } from "@motionvideo/motion-protocol/v2";


type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

type BaseTransformArgs = {
  layer: V2Layer;
  evaluatedLayer: V2Layer;
  timeSeconds: number;
};

export function layerTransformValues(layer: V2Layer): StageTransformValues {
  return {
    layerId: layer.id,
    x: layer.transform.translate.x,
    y: layer.transform.translate.y,
    width: layer.frame.width,
    height: layer.frame.height,
    rotation: layer.transform.rotate.z,
    pivotX: layer.transform.translate.x + layer.transform.anchor.x,
    pivotY: layer.transform.translate.y + layer.transform.anchor.y,
  };
}

export function buildMoveTransformCommand({
  layers,
  evaluatedLayersById,
  timeSeconds,
  deltaX,
  deltaY,
}: {
  layers: readonly V2Layer[];
  evaluatedLayersById: ReadonlyMap<string, V2Layer>;
  timeSeconds: number;
  deltaX: number;
  deltaY: number;
}): EditorCommand | null {
  return buildStageTransformCommand({
    layers,
    evaluatedLayers: layers.map((layer) => evaluatedLayersById.get(layer.id) ?? layer),
    timeSeconds,
    edit: { translateDelta: { x: deltaX, y: deltaY } },
  });
}

export function buildRotateTransformCommand({
  layer,
  evaluatedLayer,
  timeSeconds,
  rotationDelta,
}: BaseTransformArgs & { rotationDelta: number }): EditorCommand | null {
  return buildStageTransformCommand({
    layers: [layer],
    evaluatedLayers: [evaluatedLayer],
    timeSeconds,
    edit: { rotationDelta },
  });
}

function isCornerResize(handle: ResizeHandle): boolean {
  return handle.length === 2;
}

export function buildResizePreviewCommand({
  layer,
  evaluatedLayer,
  base,
  preview,
  handle,
  timeSeconds,
}: BaseTransformArgs & {
  base: StageTransformValues;
  preview: StageTransformValues;
  handle: ResizeHandle;
}): EditorCommand | null {
  if (layer.type === "text" && evaluatedLayer.type === "text" && isCornerResize(handle)) {
    return buildStageTextResizeCommand(
      layer.id,
      buildTextScaleResizeUpdate(evaluatedLayer, preview.width / Math.max(0.001, base.width), {
        x: preview.x,
        y: preview.y,
      }),
    );
  }

  return buildStageTransformCommand({
    layers: [layer],
    evaluatedLayers: [evaluatedLayer],
    timeSeconds,
    edit: {
      translateDelta: { x: preview.x - base.x, y: preview.y - base.y },
      frameDelta: { width: preview.width - base.width, height: preview.height - base.height },
    },
  });
}

export async function buildResizeTransformCommand({
  document,
  layer,
  evaluatedLayer,
  base,
  preview,
  handle,
  timeSeconds,
}: BaseTransformArgs & {
  document: MotionProtocolV2;
  base: StageTransformValues;
  preview: StageTransformValues;
  handle: ResizeHandle;
}): Promise<EditorCommand | null> {
  if (layer.type === "text" && evaluatedLayer.type === "text") {
    if (isCornerResize(handle)) {
      return buildStageTextResizeCommand(
        layer.id,
        buildTextScaleResizeUpdate(evaluatedLayer, preview.width / Math.max(0.001, base.width), {
          x: preview.x,
          y: preview.y,
        }),
      );
    }

    const textResize = await resolveStageTextResize({
      document,
      layerId: layer.id,
      layer: evaluatedLayer,
      base,
      preview,
      resizeFromLeft: handle === "w",
    });

    return buildStageTextResizeCommand(layer.id, textResize);
  }

  return buildStageTransformCommand({
    layers: [layer],
    evaluatedLayers: [evaluatedLayer],
    timeSeconds,
    edit: {
      translateDelta: { x: preview.x - base.x, y: preview.y - base.y },
      frameDelta: { width: preview.width - base.width, height: preview.height - base.height },
    },
  });
}
