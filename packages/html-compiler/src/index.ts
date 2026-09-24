export { compileDocument, compileHtmlCss, compileProject } from "./compiler/pipeline/compile";

export {
  HTML_TAG_PROFILE,
  SUPPORTED_PROPERTIES,
  SUPPORTED_TAGS,
  TEXT_CONTAINER_TAGS,
  TEXT_TAGS,
} from "./compiler/model";

export { SUPPORTED_ANIMATION_TIMING_FUNCTIONS } from "./compiler/animation";

export {
  DEFAULT_HTML_CSS_COMPOSITION,
  DEFAULT_NEONIX_HTML_DOCUMENT,
  DEFAULT_NEONIX_HTML_PROJECT_CONFIG,
  NEONIX_DOCUMENT_METADATA_JSON_SCHEMA,
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
