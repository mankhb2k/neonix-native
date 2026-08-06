/**
 * Deterministic text measurement for compile/edit layout.
 * Painters must not re-run layout — they consume baked transforms + paint typography.
 */

export type TextMeasureRequest = {
  text: string;
  fontSize: number;
  fontWeight?: number;
  letterSpacing?: number;
  lineHeight?: number;
  wrap?: "none" | "word" | "character";
  maxWidth?: number;
  maxLines?: number;
  /** Optional font family key for provider-specific metrics. */
  fontFamily?: string;
};

export type TextMeasureResult = {
  width: number;
  height: number;
  lineCount: number;
};

export type TextMeasurementProvider = {
  measure(request: TextMeasureRequest): TextMeasureResult;
};

/**
 * Deterministic fallback metrics (no DOM). Uses a stable average advance width
 * keyed by font size/weight so compile outputs stay reproducible across hosts.
 */
export const defaultTextMeasurementProvider: TextMeasurementProvider = {
  measure(request) {
    const weightFactor = request.fontWeight != null ? 0.92 + Math.min(1000, request.fontWeight) / 5000 : 1;
    const advance = request.fontSize * 0.55 * weightFactor + (request.letterSpacing ?? 0);
    const lineHeight = request.lineHeight ?? request.fontSize * 1.2;
    const lines = wrapLines(request.text, request.wrap ?? "none", request.maxWidth, advance);
    const limited =
      request.maxLines != null && request.maxLines > 0 ? lines.slice(0, request.maxLines) : lines;
    const width = Math.max(0, ...limited.map((line) => line.length * advance), 0);
    return {
      width,
      height: Math.max(lineHeight, limited.length * lineHeight),
      lineCount: Math.max(1, limited.length),
    };
  },
};

export function estimateTextSize(
  request: TextMeasureRequest,
  provider: TextMeasurementProvider = defaultTextMeasurementProvider,
): TextMeasureResult {
  return provider.measure(request);
}

function wrapLines(
  text: string,
  wrap: "none" | "word" | "character",
  maxWidth: number | undefined,
  advance: number,
): string[] {
  if (wrap === "none" || maxWidth == null || maxWidth <= 0 || advance <= 0) {
    return text.length === 0 ? [""] : text.split(/\r?\n/);
  }
  const maxChars = Math.max(1, Math.floor(maxWidth / advance));
  const paragraphs = text.split(/\r?\n/);
  const out: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      out.push("");
      continue;
    }
    if (wrap === "character") {
      for (let i = 0; i < paragraph.length; i += maxChars) {
        out.push(paragraph.slice(i, i + maxChars));
      }
      continue;
    }
    const words = paragraph.split(/(\s+)/);
    let line = "";
    for (const word of words) {
      if ((line + word).length > maxChars && line.length > 0) {
        out.push(line);
        line = word.trimStart();
      } else {
        line += word;
      }
    }
    if (line.length > 0 || words.length === 0) out.push(line);
  }
  return out.length > 0 ? out : [""];
}
