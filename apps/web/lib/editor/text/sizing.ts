import type { LayerPatch } from "@motionvideo/editor-core";
import type { V2SvgLength, V2TextLayer } from "@motionvideo/motion-protocol/v2";
import type { TextLayoutMeasurement } from "@motionvideo/motion-runtime";

export type EditorTextFrameUpdate = {
  patch: LayerPatch;
  width: number;
  height: number;
  translateX: number;
};

export type WrappedTextResizeOptions = {
  /** The new frame left edge from the transient resize session. */
  x?: number;
};

export type TextScaleResizeOptions = {
  /** The new frame top-left from the transient resize session. */
  x?: number;
  y?: number;
};

function scaleSvgLength(value: V2SvgLength, scale: number): V2SvgLength {
  return typeof value === "number"
    ? value * scale
    : { ...value, value: value.value * scale };
}

/** Build the canonical derived frame update and preserve the visible alignment edge. */
export function buildIntrinsicTextFrameUpdate(
  layer: V2TextLayer,
  measurement: TextLayoutMeasurement,
): EditorTextFrameUpdate {
  const sizing = layer.payload.layout?.sizing;
  const width = sizing === "fixed-width-auto-height" ? layer.frame.width : measurement.width;
  const height = measurement.height;
  const widthDelta = layer.frame.width - width;
  const align = layer.payload.layout?.textAlign;
  const translateX = align === "center"
    ? layer.transform.translate.x + widthDelta / 2
    : align === "right" || align === "end"
      ? layer.transform.translate.x + widthDelta
      : layer.transform.translate.x;
  const patch: LayerPatch = { frame: { width, height } };
  if (Math.abs(translateX - layer.transform.translate.x) > 0.01) {
    patch.transform = { translate: { x: translateX } };
  }
  return { patch, width, height, translateX };
}

/** Build the single command produced by a Canva-style horizontal text resize. */
export function buildWrappedTextResizeUpdate(
  layer: V2TextLayer,
  width: number,
  measurement: TextLayoutMeasurement,
  options: WrappedTextResizeOptions = {},
): EditorTextFrameUpdate {
  const nextWidth = Math.max(8, width);
  const widthDelta = layer.frame.width - nextWidth;
  const align = layer.payload.layout?.textAlign;
  const alignedTranslateX = align === "center"
    ? layer.transform.translate.x + widthDelta / 2
    : align === "right" || align === "end"
      ? layer.transform.translate.x + widthDelta
      : layer.transform.translate.x;
  const translateX = options.x ?? alignedTranslateX;
  const currentLayout = layer.payload.layout;
  const layout = currentLayout
    ? {
        ...currentLayout,
        sizing: "fixed-width-auto-height" as const,
        wrap: "word" as const,
        textAlign: "center" as const,
      }
    : {
        sizing: "fixed-width-auto-height" as const,
        lineHeight: measurement.height / Math.max(1, measurement.lineCount),
        textAlign: "center" as const,
        whiteSpace: "normal" as const,
        wrap: "word" as const,
        textOverflow: "clip" as const,
      };
  const patch: LayerPatch = {
    frame: { width: nextWidth, height: measurement.height },
    payload: { layout },
  };
  if (Math.abs(translateX - layer.transform.translate.x) > 0.01) {
    patch.transform = { translate: { x: translateX } };
  }
  return { patch, width: nextWidth, height: measurement.height, translateX };
}

/** Build the canonical command for scaling a text layer from a corner handle. */
export function buildTextScaleResizeUpdate(
  layer: V2TextLayer,
  scale: number,
  options: TextScaleResizeOptions = {},
): EditorTextFrameUpdate {
  const nextScale = Math.max(0.01, scale);
  const nextWidth = Math.max(8, layer.frame.width * nextScale);
  const nextHeight = Math.max(8, layer.frame.height * nextScale);
  const translateX = options.x ?? layer.transform.translate.x;
  const translateY = options.y ?? layer.transform.translate.y;
  const scaledLayout = layer.payload.layout
    ? {
        ...layer.payload.layout,
        lineHeight: layer.payload.layout.lineHeight * nextScale,
        ...(layer.payload.layout.contentWidth === undefined
          ? {}
          : { contentWidth: layer.payload.layout.contentWidth * nextScale }),
        ...(layer.payload.layout.contentHeight === undefined
          ? {}
          : { contentHeight: layer.payload.layout.contentHeight * nextScale }),
        ...(layer.payload.layout.contentOffsetX === undefined
          ? {}
          : { contentOffsetX: layer.payload.layout.contentOffsetX * nextScale }),
        ...(layer.payload.layout.contentOffsetY === undefined
          ? {}
          : { contentOffsetY: layer.payload.layout.contentOffsetY * nextScale }),
      }
    : undefined;
  const payload = {
    chunks: layer.payload.chunks.map((chunk) => ({
      ...chunk,
      spans: chunk.spans.map((span) => ({
        ...span,
        font: { ...span.font, size: scaleSvgLength(span.font.size, nextScale) },
      })),
    })),
    ...(scaledLayout ? { layout: scaledLayout } : {}),
  };
  const patch = {
    frame: { width: nextWidth, height: nextHeight },
    payload,
  } as LayerPatch;
  if (
    Math.abs(translateX - layer.transform.translate.x) > 0.01 ||
    Math.abs(translateY - layer.transform.translate.y) > 0.01
  ) {
    patch.transform = { translate: { x: translateX, y: translateY } };
  }
  return { patch, width: nextWidth, height: nextHeight, translateX };
}
