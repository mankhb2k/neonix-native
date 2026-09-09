import { CompileError, fail } from "./errors";
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

function readComposition(value: unknown): HtmlCssComposition {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("html-composition-invalid", "neonix-document composition must be an object");
  const composition = value as Record<string, unknown>;
  if (!Number.isInteger(composition.width) || Number(composition.width) <= 0) fail("html-composition-invalid", "neonix-document width must be a positive integer");
  if (!Number.isInteger(composition.height) || Number(composition.height) <= 0) fail("html-composition-invalid", "neonix-document height must be a positive integer");
  if (typeof composition.fps !== "number" || !Number.isFinite(composition.fps) || composition.fps <= 0) fail("html-composition-invalid", "neonix-document fps must be a positive number");
  if (typeof composition.background !== "string" || !composition.background.trim()) fail("html-composition-invalid", "neonix-document background must be a non-empty color");
  if (composition.colorSpace !== "srgb") fail("html-composition-invalid", "Only srgb color space is currently supported");
  return {
    width: Number(composition.width),
    height: Number(composition.height),
    fps: Number(composition.fps),
    background: String(composition.background),
    colorSpace: "srgb",
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
  if (metadata.kind !== "neonix-html-document") fail("html-document-kind-invalid", "neonix-document kind must be neonix-html-document");
  if (metadata.schemaVersion !== 2) fail("html-document-schema-unsupported", "neonix-document schemaVersion must be 2");
  return { kind: "neonix-html-document", schemaVersion: 2, composition: readComposition(metadata.composition) };
}

function collectStyles(html: string): { html: string; css: string } {
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
