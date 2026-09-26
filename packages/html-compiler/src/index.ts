export { compileDocument, compileHtmlCss, compileProject } from "./compiler/pipeline/compile";
export { ensureBrowserPreviewBodyStyle } from "./browser-preview-style";
export { parseNeonixDocument } from "./compiler/document";
export { LAYOUT_PROBE_ID_ATTRIBUTE, stampNodeIds, runLayoutProbe } from "./layout-probe";
export type { LayoutProbeBox, LayoutProbeResult, LayoutSnapshot } from "./layout-probe";
export { prepareHtmlTextSizing, textSizingCacheKey } from "./compiler/text-sizing";
export type { PrepareHtmlTextSizingOptions } from "./compiler/text-sizing";

export {
  HTML_TAG_PROFILE,
  ID_AUTHORING_NOTES,
  SUPPORTED_PROPERTIES,
  SUPPORTED_TAGS,
  TEXT_CONTAINER_TAGS,
  TEXT_TAGS,
} from "./compiler/model";

export { ANIMATION_CAPABILITY_NOTES, SUPPORTED_ANIMATION_TIMING_FUNCTIONS } from "./compiler/css/animation";
export { PAINT_CAPABILITY_NOTES, SUPPORTED_COLOR_FORMATS, UNSUPPORTED_COLOR_FORMATS } from "./compiler/paint/paint";

export {
  DEFAULT_HTML_CSS_COMPOSITION,
  DEFAULT_NEONIX_HTML_DOCUMENT,
  DEFAULT_NEONIX_HTML_PROJECT_CONFIG,
  NEONIX_DOCUMENT_METADATA_JSON_SCHEMA,
  NEONIX_HTML_DOCUMENT_TEMPLATE,
  createHtmlCssProject,
  createHtmlCssSource,
  createNewHtmlProject,
} from "./source";

export type {
  HtmlCompilerDiagnostic,
  HtmlCompilerOptions,
  HtmlCompilerFontAsset,
  HtmlCompilerResult,
  HtmlCompilerMediaAsset,
  HtmlCssComposition,
  HtmlCssProject,
  HtmlCssSource,
  HtmlCompilerSourceLocation,
  NeonixHtmlSourceV1,
  NeonixHtmlProjectConfig,
  HtmlDocumentInput,
  NeonixHtmlDocumentV2,
} from "./source";
