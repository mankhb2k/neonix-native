/**
 * HTML composition vocabulary.
 *
 * The compiler intentionally supports a small, video-oriented subset of
 * HTML. Semantic container/text tags are authoring aliases; lowering is still
 * decided by CSS and the visual role of the node.
 */
export const HTML_TAG_PROFILE = {
  document: ["html", "head", "meta", "body"],
  containers: ["div", "main", "section", "article", "header", "footer", "nav", "aside", "figure", "figcaption"],
  text: ["h1", "h2", "h3", "h4", "h5", "h6", "span", "p", "strong", "b", "em", "i", "small", "br", "blockquote", "pre", "code"],
  media: ["img", "video", "audio"],
  svg: ["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon"],
} as const;

export const SUPPORTED_TAGS: ReadonlySet<string> = new Set(Object.values(HTML_TAG_PROFILE).flat());
export const TEXT_TAGS = new Set<string>(HTML_TAG_PROFILE.text);
export const TEXT_CONTAINER_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "blockquote", "pre", "code"]);
