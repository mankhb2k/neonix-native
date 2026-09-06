import { compileProtocol } from "@motionvideo/motion-compiler";
import {
  measureVisualRuntimeText,
  type TextLayoutMeasurement,
  type VisualRuntimeText,
} from "@motionvideo/motion-runtime";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

const measurementCache = new Map<string, Promise<TextLayoutMeasurement | null>>();

export type EditorTextMeasurementOptions = {
  /** Measure as a wrapped text box at this width instead of the authored width. */
  width?: number;
  /** Replace the runtime text when measuring an unbreakable word. */
  text?: string;
  /** Measure the natural width without the authored frame constraint. */
  intrinsic?: boolean;
};

function loadBrowserHarfBuzz() {
  const modulePath: string = "/vendor/harfbuzz/index.mjs";
  return import(/* webpackIgnore: true */ modulePath);
}

async function resolveFont(source: { uri: string }): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(source.uri, { cache: "force-cache" });
    return response.ok ? response.arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function measureRuntimeTextContent(
  content: VisualRuntimeText,
): Promise<TextLayoutMeasurement | null> {
  const cacheKey = JSON.stringify(content);
  const cached = measurementCache.get(cacheKey);
  if (cached) return cached;
  const pending = measureVisualRuntimeText(
    content,
    (source) => resolveFont(source),
    loadBrowserHarfBuzz,
  );
  measurementCache.set(cacheKey, pending);
  return pending;
}

function runtimeTextForMeasurement(
  nodeContent: VisualRuntimeText,
  options: EditorTextMeasurementOptions,
): VisualRuntimeText {
  if (options.intrinsic) {
    return {
      ...nodeContent,
      ...(options.text === undefined ? {} : { text: options.text }),
      // Give an unbreakable word enough room to shape on one line, then use
      // the measured advance as the minimum side-resize width.
      width: Math.max(1_000_000, nodeContent.width),
      height: Math.max(1, nodeContent.height),
      contentWidth: undefined,
      contentHeight: undefined,
      contentOffsetX: undefined,
      contentOffsetY: undefined,
      sizing: "auto-width-height",
      wrap: "none",
      whiteSpace: "nowrap",
      textOverflow: "clip",
      maxLines: undefined,
    };
  }
  if (options.width === undefined && options.text === undefined) return nodeContent;
  return {
    ...nodeContent,
    ...(options.text === undefined ? {} : { text: options.text }),
    ...(options.width === undefined
      ? {}
      : {
          width: Math.max(1, options.width),
          contentWidth: Math.max(1, options.width),
          sizing: "fixed-width-auto-height" as const,
          wrap: "word" as const,
        }),
  };
}

/** Measure one V2 text layer with the exact runtime shaping pipeline. */
export async function measureEditorTextLayer(
  document: MotionProtocolV2,
  layerId: string,
  options: EditorTextMeasurementOptions = {},
): Promise<TextLayoutMeasurement | null> {
  const compiled = compileProtocol(document);
  const node = compiled.visual.nodes.find((candidate) => candidate.id === layerId);
  if (!node || node.content.kind !== "text") return null;
  const content = runtimeTextForMeasurement(node.content, options);
  return measureRuntimeTextContent(content);
}

/** Measure the narrowest useful frame: the widest unbreakable word. */
export async function measureEditorTextMinimumWidth(
  document: MotionProtocolV2,
  layerId: string,
): Promise<number | null> {
  const layer = document.layers.find((candidate) => candidate.id === layerId);
  if (!layer || layer.type !== "text") return null;
  const sourceText = layer.payload.source.text;
  const words = sourceText.match(/\S+/gu) ?? [];
  if (words.length === 0) return 8;
  const compiled = compileProtocol(document);
  const node = compiled.visual.nodes.find((candidate) => candidate.id === layerId);
  if (node?.content.kind === "text") {
    const textContent: VisualRuntimeText = node.content;
    const measurements = await Promise.all(
      words.map(async (word) => {
        try {
          return await measureRuntimeTextContent(
            runtimeTextForMeasurement(textContent, { text: word, intrinsic: true }),
          );
        } catch {
          return null;
        }
      }),
    );
    const measuredMinimum = Math.max(
      0,
      ...measurements
        .map((measurement) => measurement?.width ?? 0)
        .filter((width) => Number.isFinite(width)),
    );
    if (measuredMinimum > 0) {
      return Math.max(8, Math.min(layer.frame.width, measuredMinimum));
    }
  }
  // Font loading can fail, so keep a deterministic conservative fallback.
  const baseWidth = layer.frame.width;
  const longestWordLength = Math.max(...words.map((word) => word.length));
  return Math.max(
    8,
    Math.min(baseWidth, baseWidth * longestWordLength / Math.max(1, sourceText.length)),
  );
}
