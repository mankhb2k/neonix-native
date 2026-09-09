import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

export type HtmlCssComposition = Readonly<{
  width: number;
  height: number;
  fps: number;
  background: string;
  colorSpace: "srgb";
}>;

/** Canonical project configuration loaded from neonix.config.json. */
export type NeonixHtmlProjectConfig = Readonly<{
  kind: "neonix-html-project";
  schemaVersion: 1;
  composition: HtmlCssComposition;
}>;

/** Canonical compiler input. HTML and CSS stay as authored source files. */
export type HtmlCssProject = Readonly<{
  html: string;
  css: string;
  config: NeonixHtmlProjectConfig;
}>;

export type NeonixHtmlSourceV1 = {
  kind: "neonix-html-source";
  sourceSchemaVersion: 1;
  composition: HtmlCssComposition;
  html: string;
  css: string;
};

export type HtmlCssSource = NeonixHtmlSourceV1;

/** Metadata embedded in the single-file HTML document contract. */
export type NeonixHtmlDocumentV2 = Readonly<{
  kind: "neonix-html-document";
  schemaVersion: 2;
  composition: HtmlCssComposition;
}>;

/** Canonical AI/MCP compiler input: one self-contained HTML document. */
export type HtmlDocumentInput = Readonly<{
  html: string;
  fontAssets?: readonly HtmlCompilerFontAsset[];
  mediaAssets?: readonly HtmlCompilerMediaAsset[];
}>;
export type HtmlCompilerSourceLocation = { kind: "html" | "css"; offset: number; line: number; column: number };
export type HtmlCompilerDiagnostic = { severity: "info" | "warning" | "error"; code: string; message: string; source?: HtmlCompilerSourceLocation; selector?: string; property?: string; elementId?: string };
/**
 * Compiler/catalog input. These fields are intentionally not emitted in a
 * Protocol V2 asset; they are needed only while matching CSS font-family,
 * font-style and font-stretch against a catalog face.
 */
export type HtmlCompilerFontAsset = {
  id: string;
  kind: "font";
  uri: string;
  weight: number;
  integrity: string;
  family: string;
  style: "normal" | "italic" | "oblique";
  stretch?: "ultra-condensed" | "extra-condensed" | "condensed" | "semi-condensed" | "normal" | "semi-expanded" | "expanded" | "extra-expanded" | "ultra-expanded";
  mimeType?: "font/ttf" | "font/otf";
};
export type HtmlCompilerMediaAsset = {
  uri: string;
  kind: "image" | "video" | "audio";
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
  sampleRate?: number;
  channels?: number;
  mimeType?: string;
};
export type HtmlCompilerOptions = {
  composition?: { width?: number; height?: number; fps?: number; durationMs?: number; id?: string };
  /** Exact font binaries available to the compiler/runtime. CSS fallback is never implicit. */
  fontAssets?: readonly HtmlCompilerFontAsset[];
  /** Optional catalog metadata for CSS image/video URLs. */
  mediaAssets?: readonly HtmlCompilerMediaAsset[];
};
export type HtmlCompilerResult = { status: "success" | "error"; source: HtmlCssSource; protocol: MotionProtocolV2 | null; diagnostics: HtmlCompilerDiagnostic[] };

export const DEFAULT_HTML_CSS_COMPOSITION: HtmlCssComposition = Object.freeze({
  width: 1920,
  height: 1080,
  fps: 30,
  background: "#081018",
  colorSpace: "srgb",
});

export const DEFAULT_NEONIX_HTML_DOCUMENT = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
</head>
<body>
</body>
</html>`;

export const DEFAULT_NEONIX_HTML_PROJECT_CONFIG: NeonixHtmlProjectConfig = Object.freeze({
  kind: "neonix-html-project",
  schemaVersion: 1,
  composition: DEFAULT_HTML_CSS_COMPOSITION,
});

export function createHtmlCssProject(input: Partial<HtmlCssProject> = {}): HtmlCssProject {
  return {
    html: input.html ?? DEFAULT_NEONIX_HTML_DOCUMENT,
    css: input.css ?? "",
    config: input.config ?? DEFAULT_NEONIX_HTML_PROJECT_CONFIG,
  };
}

export function createNewHtmlProject(input: Partial<Pick<NeonixHtmlSourceV1, "html" | "css">> = {}): NeonixHtmlSourceV1 {
  return {
    kind: "neonix-html-source",
    sourceSchemaVersion: 1,
    composition: { ...DEFAULT_HTML_CSS_COMPOSITION },
    html: input.html ?? DEFAULT_NEONIX_HTML_DOCUMENT,
    css: input.css ?? "",
  };
}

export function createHtmlCssSource(input: Partial<Pick<HtmlCssSource, "html" | "css">> = {}): HtmlCssSource {
  return createNewHtmlProject(input);
}
