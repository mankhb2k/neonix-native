import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import type { LayoutSnapshot } from "./layout-probe";

export type HtmlCssComposition = Readonly<{
  width: number;
  height: number;
  fps: number;
  background: string;
  colorSpace: "srgb";
  /** Minimum output duration in milliseconds. The export is never shorter than
   * this, but a longer animation timeline still wins — this only pads with
   * static trailing frames, it never truncates content. Defaults to 1000ms
   * when omitted. */
  durationMs?: number;
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
/**
 * Real per-node text measurement, keyed by `textSizingCacheKey()`
 * (compiler/text-sizing.ts) - produced ahead of time by `prepareHtmlTextSizing()`
 * from the SAME real HarfBuzz shaping Preview/export use, and consulted by
 * `layout()` instead of its own character-count heuristic wherever a key
 * matches. Optional and purely additive: omitting it (the default) keeps
 * today's synchronous, heuristic-only behavior unchanged.
 */
export type HtmlTextSizingLookup = ReadonlyMap<string, { height: number }>;

export type HtmlCompilerOptions = {
  composition?: { width?: number; height?: number; fps?: number; durationMs?: number; id?: string };
  /** Exact font binaries available to the compiler/runtime. CSS fallback is never implicit. */
  fontAssets?: readonly HtmlCompilerFontAsset[];
  /** Optional catalog metadata for CSS image/video URLs. */
  mediaAssets?: readonly HtmlCompilerMediaAsset[];
  /** Real per-node text measurement from `prepareHtmlTextSizing()`. See `HtmlTextSizingLookup`. */
  textSizing?: HtmlTextSizingLookup;
  /**
   * Real per-node layout geometry measured from a real browser via
   * `stampNodeIds()` + `runLayoutProbe()` (see layout-probe.ts). Keyed by
   * `LAYOUT_PROBE_ID_ATTRIBUTE`; `resolveNodeBox()` consults it by that key
   * per node instead of running its own flex/grid/geometry resolution for
   * that node. Optional and purely additive, same contract as `textSizing`:
   * a missing key (or omitting `layoutSnapshot` entirely, the default) is
   * always safe - it just means "no improvement for this node," never a
   * wrong compile.
   */
  layoutSnapshot?: LayoutSnapshot;
  /**
   * Test/dev-only. When true and `layoutSnapshot` is set, ANY node without a
   * snapshot entry (a genuine miss, or a permanent CDP exclusion - under a
   * CSS transform, or SVG) is a hard compile error instead of the normal
   * native fallback. Never set this from a production caller - see
   * node-box.ts's `NodeBoxDeps.layoutSnapshotStrict` for the full contract.
   */
  layoutSnapshotStrict?: boolean;
};
export type HtmlCompilerResult = { status: "success" | "error"; source: HtmlCssSource; protocol: MotionProtocolV2 | null; diagnostics: HtmlCompilerDiagnostic[] };

export const DEFAULT_HTML_CSS_COMPOSITION: HtmlCssComposition = Object.freeze({
  width: 1920,
  height: 1080,
  fps: 30,
  background: "#081018",
  colorSpace: "srgb",
});

/**
 * JSON Schema for the content of `meta[name="neonix-document"]`, kept in sync
 * by hand with the runtime checks in compiler/document.ts (there is no
 * schema-validator dependency in this package to generate it from).
 */
export const NEONIX_DOCUMENT_METADATA_JSON_SCHEMA = Object.freeze({
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "Neonix HTML document metadata",
  description:
    'JSON content of the meta[name="neonix-document"] tag required in every Neonix HTML document.',
  type: "object",
  required: ["kind", "schemaVersion", "composition"],
  properties: {
    kind: { const: "neonix-html-document" },
    schemaVersion: { const: 2 },
    composition: {
      type: "object",
      required: ["width", "height", "fps", "background", "colorSpace"],
      properties: {
        width: { type: "integer", minimum: 1, description: "Output width in pixels." },
        height: { type: "integer", minimum: 1, description: "Output height in pixels." },
        fps: { type: "number", exclusiveMinimum: 0, description: "Frame rate." },
        background: { type: "string", minLength: 1, description: "Base background color, as any valid CSS color string." },
        colorSpace: { const: "srgb", description: 'Only "srgb" is currently supported.' },
        durationMs: {
          type: "number",
          exclusiveMinimum: 0,
          description:
            "Optional minimum output duration in milliseconds. The export is never shorter than this, but a longer animation timeline still wins — this only pads trailing static frames, it never truncates content. Defaults to 1000ms when omitted.",
        },
      },
    },
  },
  example: {
    kind: "neonix-html-document",
    schemaVersion: 2,
    composition: DEFAULT_HTML_CSS_COMPOSITION,
  },
} as const);

export const DEFAULT_NEONIX_HTML_DOCUMENT = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
</head>
<body>
</body>
</html>`;

/**
 * Boilerplate for a new neonix-document: the required scaffold (doctype,
 * charset, neonix-document meta with a default composition, empty
 * data-neonix-bundle style block) already filled in, so callers only need to
 * add CSS rules and body markup instead of reconstructing the contract by
 * hand each time. Exposed to MCP callers via get_capabilities.
 */
export const NEONIX_HTML_DOCUMENT_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="neonix-document"
      content='${JSON.stringify({
        kind: "neonix-html-document",
        schemaVersion: 2,
        composition: DEFAULT_HTML_CSS_COMPOSITION,
      })}'
    />
    <style data-neonix-bundle>
      html, body {
        margin: 0;
        width: ${DEFAULT_HTML_CSS_COMPOSITION.width}px;
        height: ${DEFAULT_HTML_CSS_COMPOSITION.height}px;
        overflow: hidden;
      }
      /* Add your CSS rules here. */
    </style>
  </head>

  <body>
    <!-- Add your HTML elements here. -->
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
