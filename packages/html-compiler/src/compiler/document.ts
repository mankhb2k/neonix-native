import { CompileError, CompileIssues, fail, type CompileIssue } from "./errors";
import type { HtmlCssComposition, HtmlDocumentInput, NeonixHtmlDocumentV2 } from "../source";

type ParsedDocument = Readonly<{
  metadata: NeonixHtmlDocumentV2;
  composition: HtmlCssComposition;
  html: string;
  css: string;
}>;

function attributeValue(attributes: string, name: string): string | undefined {
  const pattern = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i");
  return attributes.match(pattern)?.[2];
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

/**
 * Reports every invalid composition field in one pass (pushed onto `issues`)
 * instead of stopping at the first one, since the five fields are
 * independent of each other and a caller fixing them one at a time
 * shouldn't need a validate round-trip per field.
 */
function readComposition(value: unknown, issues: CompileIssue[]): HtmlCssComposition | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push({ code: "html-composition-invalid", message: "neonix-document composition must be an object" });
    return undefined;
  }
  const composition = value as Record<string, unknown>;
  const before = issues.length;
  if (!Number.isInteger(composition.width) || Number(composition.width) <= 0) issues.push({ code: "html-composition-invalid", message: "neonix-document width must be a positive integer" });
  if (!Number.isInteger(composition.height) || Number(composition.height) <= 0) issues.push({ code: "html-composition-invalid", message: "neonix-document height must be a positive integer" });
  if (typeof composition.fps !== "number" || !Number.isFinite(composition.fps) || composition.fps <= 0) issues.push({ code: "html-composition-invalid", message: "neonix-document fps must be a positive number" });
  if (typeof composition.background !== "string" || !composition.background.trim()) issues.push({ code: "html-composition-invalid", message: "neonix-document background must be a non-empty color" });
  if (composition.colorSpace !== "srgb") issues.push({ code: "html-composition-invalid", message: "Only srgb color space is currently supported" });
  if (composition.durationMs !== undefined && (typeof composition.durationMs !== "number" || !Number.isFinite(composition.durationMs) || composition.durationMs <= 0)) {
    issues.push({ code: "html-composition-invalid", message: "neonix-document durationMs must be a positive number" });
  }
  if (issues.length > before) return undefined;
  return {
    width: Number(composition.width),
    height: Number(composition.height),
    fps: Number(composition.fps),
    background: String(composition.background),
    colorSpace: "srgb",
    ...(composition.durationMs === undefined ? {} : { durationMs: Number(composition.durationMs) }),
  };
}

function parseMetadata(html: string): NeonixHtmlDocumentV2 {
  const matches = [...html.matchAll(/<meta\b([^>]*)>/gi)].filter((match) => attributeValue(match[1] ?? "", "name")?.toLowerCase() === "neonix-document");
  if (matches.length === 0) fail("html-document-metadata-missing", "The document must contain exactly one meta[name=\"neonix-document\"]");
  if (matches.length > 1) fail("html-document-metadata-duplicate", "The document must contain exactly one meta[name=\"neonix-document\"]");
  const meta = matches[0];
  if (!meta) fail("html-document-metadata-missing", "The document must contain exactly one meta[\"name=neonix-document\"]");
  const rawContent = attributeValue(meta[1] ?? "", "content");
  const content = rawContent ?? fail("html-document-metadata-invalid", "neonix-document meta must have a content attribute");
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeHtmlAttribute(content));
  } catch {
    fail("html-document-metadata-invalid", "neonix-document meta content must contain valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail("html-document-metadata-invalid", "neonix-document meta content must be a JSON object");
  const metadata = parsed as { kind?: unknown; schemaVersion?: unknown; composition?: unknown };

  // These three checks are independent of each other, so every failure is
  // reported together rather than one validate_html round-trip per field.
  const issues: CompileIssue[] = [];
  if (metadata.kind !== "neonix-html-document") issues.push({ code: "html-document-kind-invalid", message: "neonix-document kind must be neonix-html-document" });
  if (metadata.schemaVersion !== 2) issues.push({ code: "html-document-schema-unsupported", message: "neonix-document schemaVersion must be 2" });
  const composition = readComposition(metadata.composition, issues);
  if (issues.length > 0) throw new CompileIssues(issues);

  return { kind: "neonix-html-document", schemaVersion: 2, composition: composition! };
}

export function collectStyles(html: string): { html: string; css: string } {
  const css: string[] = [];
  const withoutStyles = html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi, (_match, attributes: string, content: string) => {
    const type = attributeValue(attributes, "type");
    if (type && type.trim().toLowerCase() !== "text/css") fail("html-document-style-unsupported", `Unsupported <style> type: ${type}`);
    css.push(content);
    return "";
  });
  return { html: withoutStyles, css: css.join("\n") };
}

/** Parse the single-file HTML contract and normalize embedded CSS resources. */
export function parseNeonixDocument(input: HtmlDocumentInput): ParsedDocument {
  if (typeof input.html !== "string" || !input.html.trim()) fail("html-document-empty", "HTML document must be a non-empty string");
  const metadata = parseMetadata(input.html);
  const resources = collectStyles(input.html);
  const html = resources.html.replace(/<meta\b([^>]*)>\s*/gi, (match, attributes: string) => attributeValue(attributes, "name")?.toLowerCase() === "neonix-document" ? "" : match);
  return { metadata, composition: metadata.composition, html, css: resources.css };
}

export function isCompileError(error: unknown): error is CompileError {
  return error instanceof CompileError;
}
