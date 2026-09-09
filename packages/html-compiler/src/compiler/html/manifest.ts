import type { HtmlCssComposition } from "../../source";
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
  const manifest = parsed as { kind?: unknown; sourceSchemaVersion?: unknown; schemaVersion?: unknown; composition?: Record<string, unknown> };
  const composition = manifest.composition;
  const width = composition?.width;
  const height = composition?.height;
  const fps = composition?.fps;
  const background = composition?.background;
  const colorSpace = composition?.colorSpace;
  if (
    !["neonix-html-source", "neonix-html-project"].includes(String(manifest.kind)) ||
    manifest.sourceSchemaVersion !== 1 && manifest.schemaVersion !== 1 ||
    !composition ||
    typeof width !== "number" || !Number.isInteger(width) || width <= 0 ||
    typeof height !== "number" || !Number.isInteger(height) || height <= 0 ||
    typeof fps !== "number" || !Number.isFinite(fps) || fps <= 0 ||
    typeof background !== "string" ||
    colorSpace !== "srgb"
  ) {
    fail("html-manifest-invalid", "neonix-manifest must declare a valid composition");
  }
  return {
    width: width as number,
    height: height as number,
    fps: fps as number,
    background: background as string,
    colorSpace: "srgb",
  };
}

export function withoutNeonixManifest(html: string): string {
  return html.replace(/<script\b(?=[^>]*\bid\s*=\s*["']neonix-manifest["'])(?=[^>]*\btype\s*=\s*["']application\/json["'])[^>]*>[\s\S]*?<\/script>/i, "");
}
