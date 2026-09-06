import { compileProtocol } from "@motionvideo/motion-compiler";
import {
  measureVisualRuntimeText,
  type TextLayoutMeasurement,
} from "@motionvideo/motion-runtime";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

const measurementCache = new Map<string, Promise<TextLayoutMeasurement | null>>();

export type EditorTextMeasurementOptions = {
  /** Measure as a wrapped text box at this width instead of the authored width. */
  width?: number;
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
  content: Parameters<typeof measureVisualRuntimeText>[0],
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

/** Measure one V2 text layer with the exact runtime shaping pipeline. */
export async function measureEditorTextLayer(
  document: MotionProtocolV2,
  layerId: string,
  options: EditorTextMeasurementOptions = {},
): Promise<TextLayoutMeasurement | null> {
  const compiled = compileProtocol(document);
  const node = compiled.visual.nodes.find((candidate) => candidate.id === layerId);
  if (!node || node.content.kind !== "text") return null;
  const content = options.width === undefined
    ? node.content
    : {
        ...node.content,
        width: Math.max(1, options.width),
        contentWidth: Math.max(1, options.width),
        sizing: "fixed-width-auto-height" as const,
        wrap: "word" as const,
      };
  return measureRuntimeTextContent(content);
}

/** Measure the narrowest useful frame: the widest unbreakable word. */
export function measureEditorTextMinimumWidth(
  document: MotionProtocolV2,
  layerId: string,
): number | null {
  const layer = document.layers.find((candidate) => candidate.id === layerId);
  if (!layer || layer.type !== "text") return null;
  const sourceText = layer.payload.source.text;
  const words = sourceText.match(/\S+/gu) ?? [];
  if (words.length === 0) return 8;
  // Keep the guard synchronous and deterministic during pointer-up. Font
  // loading is allowed to be slow or unavailable, so a resize must not wait
  // for per-word shaping before it can commit. The auto-fit frame gives us a
  // good baseline for a conservative widest-word estimate.
  const baseWidth = layer.frame.width;
  const longestWordLength = Math.max(...words.map((word) => word.length));
  return Math.max(
    8,
    Math.min(baseWidth, baseWidth * longestWordLength / Math.max(1, sourceText.length)),
  );
}
