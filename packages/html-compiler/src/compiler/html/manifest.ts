import { DEFAULT_HTML_CSS_COMPOSITION, type HtmlCssComposition } from "../../source";
import { fail } from "../errors";

export function neonixManifest(html: string): HtmlCssComposition | undefined {
  const match = html.match(/<script\b(?=[^>]*\bid\s*=\s*["']neonix-manifest["'])(?=[^>]*\btype\s*=\s*["']application\/json["'])[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]!.trim());
  } catch {
    fail("html-manifest-invalid", "neonix-manifest must contain valid JSON");
  }
  if (!parsed || typeof parsed !== "object") fail("html-manifest-invalid", "neonix-manifest must contain a JSON object");
  const manifest = parsed as { kind?: unknown; sourceSchemaVersion?: unknown; composition?: Record<string, unknown> };
  const composition = manifest.composition;
  if (manifest.kind !== "neonix-html-source" || manifest.sourceSchemaVersion !== 1 || !composition || composition.width !== 1920 || composition.height !== 1080 || composition.fps !== 30 || composition.background !== "#081018" || composition.colorSpace !== "srgb") {
    fail("html-manifest-invalid", "neonix-manifest must declare the fixed 1920x1080 @ 30 composition with #081018 srgb");
  }
  return DEFAULT_HTML_CSS_COMPOSITION;
}

export function withoutNeonixManifest(html: string): string {
  return html.replace(/<script\b(?=[^>]*\bid\s*=\s*["']neonix-manifest["'])(?=[^>]*\btype\s*=\s*["']application\/json["'])[^>]*>[\s\S]*?<\/script>/i, "");
}
