import {
  measureEditorTextLayer,
  measureEditorTextMinimumWidth,
} from "@/lib/editor/text/measurement";
import {
  buildWrappedTextResizeUpdate,
  type StageTextFrameUpdate,
  type StageTransformValues,
} from "@motionvideo/editor-core/interactions/stage";
import {
  buildTextEditFramePreview,
  type TextEditFramePreview,
} from "@motionvideo/editor-core/text";
import type { MotionProtocolV2, V2TextLayer } from "@motionvideo/motion-protocol/v2";
import type { TextLayoutMeasurement } from "@motionvideo/motion-runtime";

type Input = {
  document: MotionProtocolV2;
  layerId: string;
  layer: V2TextLayer;
  base: StageTransformValues;
  preview: StageTransformValues;
  resizeFromLeft: boolean;
};

export type TextEditFramePreviewInput = {
  document: MotionProtocolV2;
  layer: V2TextLayer;
  draftText: string;
  beforeText: string;
};

/**
 * Shared browser measurement bridge for text-edit auto-height previews.
 * The hook supplies state; this adapter owns line-height and measurement policy.
 */
export function createTextEditFramePreview(
  input: TextEditFramePreviewInput,
): { immediate: TextEditFramePreview; measured: Promise<TextEditFramePreview> } | null {
  const lineHeight = Math.max(
    1,
    input.layer.payload.layout?.lineHeight
      ?? Number(input.layer.payload.chunks[0]?.spans[0]?.font.size ?? 64) * 1.2,
  );
  const wrapsText = input.layer.payload.layout?.wrap !== "none";
  const immediate = buildTextEditFramePreview({
    layerId: input.layer.id,
    beforeText: input.beforeText,
    draftText: input.draftText,
    lineHeight,
    wrapsText,
  });
  if (!immediate) return null;
  const measuredDocument = {
    ...input.document,
    layers: input.document.layers.map((candidate) =>
      candidate.id === input.layer.id ? input.layer : candidate),
  };
  const measured = measureEditorTextLayer(measuredDocument, input.layer.id, {
    width: Math.max(1, input.layer.frame.width),
    text: input.draftText,
  }).then((measurement) => {
    return buildTextEditFramePreview({
      layerId: input.layer.id,
      beforeText: input.beforeText,
      draftText: input.draftText,
      lineHeight,
      wrapsText,
      measuredLineCount: measurement?.lineCount,
    }) ?? immediate;
  });
  return {
    immediate,
    measured,
  };
}

function fallbackMeasurement(
  layer: V2TextLayer,
  targetWidth: number,
): TextLayoutMeasurement {
  const lineHeight = layer.payload.layout?.lineHeight
    ?? Number(layer.payload.chunks[0]?.spans[0]?.font.size ?? 64) * 1.2;
  const estimatedLineCount = Math.max(1, Math.ceil(layer.frame.width / Math.max(targetWidth, 1)));
  return {
    width: targetWidth,
    height: lineHeight * estimatedLineCount,
    lineCount: estimatedLineCount,
    lines: Array.from({ length: estimatedLineCount }, (_, index) => ({
      advance: targetWidth,
      baseline: lineHeight * (index + 1),
    })),
    ascender: 0,
    descender: 0,
    resolvedFontAssetIds: [],
  };
}

/** Browser measurement bridge for the core text-resize policy. */
export async function resolveStageTextResize(
  input: Input,
): Promise<StageTextFrameUpdate> {
  const evaluatedDocument = {
    ...input.document,
    layers: input.document.layers.map((candidate) =>
      candidate.id === input.layerId ? input.layer : candidate),
  };
  const minimumWidth = await measureEditorTextMinimumWidth(evaluatedDocument, input.layerId);
  const targetWidth = Math.max(8, input.preview.width, minimumWidth ?? 8);
  const measurementPromise = measureEditorTextLayer(
    {
      ...input.document,
      layers: input.document.layers.map((candidate) =>
        candidate.id === input.layerId
          ? { ...input.layer, frame: { ...input.layer.frame, width: targetWidth } }
          : candidate),
    },
    input.layerId,
    { width: targetWidth },
  );
  const measured = await Promise.race([
    measurementPromise,
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), 1000);
    }),
  ]);
  const measurement = measured ?? fallbackMeasurement(input.layer, targetWidth);
  return buildWrappedTextResizeUpdate(input.layer, targetWidth, measurement, {
    x: input.resizeFromLeft
      ? input.base.x + input.base.width - targetWidth
      : input.preview.x,
  });
}
