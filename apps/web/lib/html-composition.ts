export type HtmlComposition = {
  width: number;
  height: number;
  fps: number;
  /** null when the document does not declare a duration (it is only required to export). */
  durationMs: number | null;
};

const META_PATTERN = /<meta\b[^>]*\bname\s*=\s*["']neonix-document["'][^>]*>/i;
const CONTENT_PATTERN = /\bcontent\s*=\s*(?:'([^']*)'|"([^"]*)")/i;

function decodeAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** Reads the composition declared by the `neonix-document` meta tag, or null when it is missing or malformed. */
export function readHtmlComposition(html: string): HtmlComposition | null {
  const meta = META_PATTERN.exec(html)?.[0];
  if (!meta) return null;
  const content = CONTENT_PATTERN.exec(meta);
  const raw = content?.[1] ?? content?.[2];
  if (raw === undefined) return null;

  try {
    const parsed = JSON.parse(decodeAttribute(raw)) as { composition?: Record<string, unknown> };
    const composition = parsed.composition;
    const width = positiveNumber(composition?.width);
    const height = positiveNumber(composition?.height);
    if (!width || !height) return null;
    return {
      width,
      height,
      fps: positiveNumber(composition?.fps) ?? 30,
      durationMs: positiveNumber(composition?.durationMs),
    };
  } catch {
    return null;
  }
}
