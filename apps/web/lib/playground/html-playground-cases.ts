import { HTML_COMPILER_FIXTURE_ROOT, HTML_COMPILER_PREVIEW_CASES } from "@/lib/docs/html-compiler-preview";

export type HtmlPlaygroundCaseCategory = "review" | "production";

/**
 * Which rendering concern a fixture exercises. This is the grouping shown in
 * the native-stage dropdown; it is independent of `category` (review vs
 * production readiness). These match the physical subfolders under
 * `apps/web/public/docs/html-compiler/fixtures/`, one per rendering concern.
 */
export type HtmlPlaygroundCaseGroup =
  | "debug"
  | "paint"
  | "mask"
  | "blend"
  | "text"
  | "effect"
  | "layout"
  | "perspective"
  | "motion"
  | "texture"
  | "tags"
  | "geometry"
  | "media"
  | "transform"
  | "neonix"
  | "svg";

export type HtmlPlaygroundCase = {
  id: string;
  label: string;
  description: string;
  url: string;
  category: HtmlPlaygroundCaseCategory;
  group: HtmlPlaygroundCaseGroup;
  nativeStage: boolean;
};

export const HTML_PLAYGROUND_GROUP_ORDER: readonly HtmlPlaygroundCaseGroup[] = [
  "debug",
  "paint",
  "mask",
  "blend",
  "text",
  "effect",
  "layout",
  "perspective",
  "motion",
  "texture",
  "tags",
  "geometry",
  "media",
  "transform",
  "neonix",
  "svg",
];

export const HTML_PLAYGROUND_GROUP_LABELS: Record<HtmlPlaygroundCaseGroup, string> = {
  debug: "Debug",
  paint: "Paint",
  mask: "Mask",
  blend: "Blend",
  text: "Text",
  effect: "Effect",
  layout: "Layout",
  perspective: "Perspective",
  motion: "Motion",
  texture: "Texture",
  tags: "Tags",
  geometry: "Geometry",
  media: "Media",
  transform: "Transform",
  neonix: "Neonix",
  svg: "SVG",
};

const HTML_PLAYGROUND_GROUP_SET: ReadonlySet<string> = new Set(HTML_PLAYGROUND_GROUP_ORDER);

/**
 * Folder segments that don't map 1:1 to a native-stage group because two
 * physical fixture folders were merged into one catalog for browsing.
 */
const FIXTURE_FOLDER_GROUP_ALIASES: Record<string, HtmlPlaygroundCaseGroup> = {
  typography: "text",
  opacity: "blend",
};

/** Reads the fixture's folder segment straight off its URL, so grouping can never drift from where the file actually lives. */
function groupFromFixtureUrl(url: string): HtmlPlaygroundCaseGroup | null {
  const prefix = `${HTML_COMPILER_FIXTURE_ROOT}/`;
  if (!url.startsWith(prefix)) return null;
  const rest = url.slice(prefix.length);
  const slashIndex = rest.indexOf("/");
  if (slashIndex === -1) return null;
  const folder = rest.slice(0, slashIndex);
  if (folder in FIXTURE_FOLDER_GROUP_ALIASES) return FIXTURE_FOLDER_GROUP_ALIASES[folder];
  return HTML_PLAYGROUND_GROUP_SET.has(folder) ? (folder as HtmlPlaygroundCaseGroup) : null;
}

/**
 * Playground fixtures live inside the single shared fixture tree at
 * `apps/web/public/docs/html-compiler/fixtures/<category>/`, alongside every
 * other HTML compiler fixture. There is no separate playground fixture root.
 */
const fixtureUrl = (category: string, fileName: string) => `${HTML_COMPILER_FIXTURE_ROOT}/${category}/${fileName}`;

/**
 * Hand-curated fixtures authored specifically for native-stage review
 * (CanvasKit vs browser CSS), not part of the compiler's own fixture
 * registry.
 */
const CURATED_CASES: readonly HtmlPlaygroundCase[] = [
  // --- text: topic catalog (text + typography merged; each fixture = 1 concept, multiple examples inside) ---
  {
    id: "text-gradient-paint",
    label: "Text / Gradient paint",
    description: "background-clip: text with linear, radial, and conic gradients.",
    url: fixtureUrl("text", "text-gradient-paint.html"),
    category: "review",
    group: "text",
    nativeStage: true,
  },
  {
    id: "text-compiler-contracts",
    label: "Text / Compiler contracts",
    description: "<br> as a hard break, nested inline tags merging into one layer, and white-space: normal vs pre.",
    url: fixtureUrl("text", "text-compiler-contracts.html"),
    category: "review",
    group: "text",
    nativeStage: true,
  },
  {
    id: "text-frame-sizing",
    label: "Text / Frame sizing",
    description: "Fixed height with explicit line breaks, fixed width with word wrap, and width-authored height:auto.",
    url: fixtureUrl("text", "text-frame-sizing.html"),
    category: "review",
    group: "text",
    nativeStage: true,
  },
  {
    id: "line-height",
    label: "Text / Line-height",
    description: "Fixed line-height, the normal keyword, and a unitless value.",
    url: fixtureUrl("text", "line-height.html"),
    category: "review",
    group: "text",
    nativeStage: true,
  },
  {
    id: "font-fallback",
    label: "Text / Font fallback",
    description: "Nearest-weight fallback, missing-family fallback, and emoji script fallback.",
    url: fixtureUrl("text", "font-fallback.html"),
    category: "review",
    group: "text",
    nativeStage: true,
  },
  {
    id: "font-selection-basics",
    label: "Text / Font selection basics",
    description: "Exact family/weight resolution across Inter, Lora, Roboto, Noto Sans, and an emoji fallback line.",
    url: fixtureUrl("text", "font-selection-basics.html"),
    category: "review",
    group: "text",
    nativeStage: true,
  },
  {
    id: "text-overflow-rendering",
    label: "Text / Overflow & rendering",
    description: "text-overflow: ellipsis on a clipped single line, and the 3 text-rendering values.",
    url: fixtureUrl("text", "text-overflow-rendering.html"),
    category: "review",
    group: "text",
    nativeStage: true,
  },
  {
    id: "line-clamp",
    label: "Text / Line clamp",
    description: "-webkit-line-clamp: 2 and 3, plus box-orient: horizontal (where line-clamp has no effect per spec).",
    url: fixtureUrl("text", "line-clamp.html"),
    category: "review",
    group: "text",
    nativeStage: true,
  },
  {
    id: "text-indent",
    label: "Text / Text indent",
    description: "A positive text-indent, a negative (hanging) indent, and indent inherited from an ancestor.",
    url: fixtureUrl("text", "text-indent.html"),
    category: "review",
    group: "text",
    nativeStage: true,
  },
  {
    id: "font-variant-small-caps",
    label: "Text / Font-variant small-caps",
    description: "font-variant: small-caps and the font shorthand's small-caps token, next to a normal baseline. Inter has no true small-caps glyphs, so the browser synthesizes small caps while the native renderer (which only requests the real OpenType feature) renders unchanged text - a known, deliberate divergence, not a bug.",
    url: fixtureUrl("text", "font-variant-small-caps.html"),
    category: "review",
    group: "text",
    nativeStage: true,
  },
  {
    id: "overflow-wrap-word-break",
    label: "Text / Overflow-wrap & word-break",
    description: "An unbreakable long word left to overflow (normal), word-break: break-all, and overflow-wrap: break-word.",
    url: fixtureUrl("text", "overflow-wrap-word-break.html"),
    category: "review",
    group: "text",
    nativeStage: true,
  },
  {
    id: "vertical-align",
    label: "Text / Vertical align",
    description: "vertical-align: super and sub on inline spans, and a numeric length shift, each within one sentence.",
    url: fixtureUrl("text", "vertical-align.html"),
    category: "review",
    group: "text",
    nativeStage: true,
  },
  {
    id: "text-decoration-style",
    label: "Text / Decoration style",
    description: "text-decoration-style: wavy, dotted, and dashed underlines.",
    url: fixtureUrl("text", "text-decoration-style.html"),
    category: "review",
    group: "text",
    nativeStage: true,
  },
  // --- paint: topic catalog (each fixture = 1 CSS concept, multiple examples inside) ---
  {
    id: "background-image",
    label: "Paint / Background image",
    description: "background-position+size, background-origin+clip, background-repeat, and a 2-layer background-image list.",
    url: fixtureUrl("paint", "background-image.html"),
    category: "review",
    group: "paint",
    nativeStage: true,
  },
  {
    id: "image-source-functions",
    label: "Paint / Image source functions",
    description: "image(url(...)), image(gradient, fallback), and cross-fade(url, url, 50%).",
    url: fixtureUrl("paint", "image-source-functions.html"),
    category: "review",
    group: "paint",
    nativeStage: true,
  },
  {
    id: "gradient-shapes",
    label: "Paint / Gradient shapes",
    description: "linear (3-stop and 4-stop diagonal), radial, and conic gradients.",
    url: fixtureUrl("paint", "gradient-shapes.html"),
    category: "review",
    group: "paint",
    nativeStage: true,
  },
  {
    id: "gradient-repeating",
    label: "Paint / Repeating gradients",
    description: "repeating-linear, repeating-radial, repeating-conic, and a repeating layer over a solid base.",
    url: fixtureUrl("paint", "gradient-repeating.html"),
    category: "review",
    group: "paint",
    nativeStage: true,
  },
  {
    id: "border-style",
    label: "Paint / Border style keywords",
    description: "double, groove, ridge, inset, outset border styles at the same width.",
    url: fixtureUrl("paint", "border-style.html"),
    category: "review",
    group: "paint",
    nativeStage: true,
  },
  {
    id: "border-per-side",
    label: "Paint / Border per-side",
    description: "4 independent side widths/colors, solid+none alternating, dashed+dotted alternating.",
    url: fixtureUrl("paint", "border-per-side.html"),
    category: "review",
    group: "paint",
    nativeStage: true,
  },
  {
    id: "border-radius-forms",
    label: "Paint / Border-radius forms",
    description: "uniform scalar, 4-corner list, and elliptical slash-form border-radius.",
    url: fixtureUrl("paint", "border-radius-forms.html"),
    category: "review",
    group: "paint",
    nativeStage: true,
  },
  {
    id: "border-dashed-rounded",
    label: "Paint / Dashed & rounded border geometry",
    description: "Corner-fit dashed/dotted borders, rounded dash continuity at small/large/pill radius, and a rotated dashed stroke.",
    url: fixtureUrl("paint", "border-dashed-rounded.html"),
    category: "review",
    group: "paint",
    nativeStage: true,
  },
  {
    id: "outline",
    label: "Paint / Outline",
    description: "Outline doesn't consume layout space, positive vs negative outline-offset, and outline following a per-corner radius.",
    url: fixtureUrl("paint", "outline.html"),
    category: "review",
    group: "paint",
    nativeStage: true,
  },
  {
    id: "box-shadow",
    label: "Paint / Box shadow",
    description: "A single box-shadow vs a comma-separated list of 2 shadows.",
    url: fixtureUrl("paint", "box-shadow.html"),
    category: "review",
    group: "paint",
    nativeStage: true,
  },
  {
    id: "text-shadow",
    label: "Paint / Text shadow",
    description: "text-shadow: offset+blur, alpha silhouette, blur-only, and offset-only.",
    url: fixtureUrl("paint", "text-shadow.html"),
    category: "review",
    group: "paint",
    nativeStage: true,
  },
  // --- text-shadow halo calibration: isolated blur-radius probes for browser-vs-native sigma parity ---
  {
    id: "text-shadow-halo-4",
    label: "Debug / Text shadow halo · blur 4px",
    description: "Single red glyph on black with a 0/0/4px white text-shadow, isolated for pixel-level halo measurement against the browser.",
    url: fixtureUrl("debug", "text-shadow-halo-4.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "text-shadow-halo-24",
    label: "Debug / Text shadow halo · blur 24px",
    description: "Single red glyph on black with a 0/0/24px white text-shadow, isolated for pixel-level halo measurement against the browser.",
    url: fixtureUrl("debug", "text-shadow-halo-24.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "text-shadow-halo-40",
    label: "Debug / Text shadow halo · blur 40px",
    description: "Single red glyph on black with a 0/0/40px white text-shadow, isolated for pixel-level halo measurement against the browser.",
    url: fixtureUrl("debug", "text-shadow-halo-40.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "bidi-arabic-latin",
    label: "Debug / Bidi · Arabic + Latin",
    description: "Embedded Arabic word inside an LTR sentence, a pure RTL Arabic paragraph, and an RTL paragraph with an embedded LTR number - to measure real Chrome bidi reordering against native.",
    url: fixtureUrl("debug", "bidi-arabic-latin.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "bidi-hebrew-latin",
    label: "Debug / Bidi · Hebrew + Latin",
    description: "Embedded Hebrew word inside an LTR sentence, a pure RTL Hebrew paragraph, and an RTL paragraph with an embedded LTR number - to measure real Chrome bidi reordering against native.",
    url: fixtureUrl("debug", "bidi-hebrew-latin.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "neonix-motion-test-10s",
    label: "Debug / Realistic 10s motion test (orbs, ring, glow title, cards, scanline)",
    description: "Full composite scene from a real user test: blurred glow orbs, a rotating ring with animated hue-rotate filter, a glow-pulsing title with animated text-shadow, backdrop-filter badge/cards, and a mix-blend-mode scanline sweep - to analyze together against browser CSS.",
    url: fixtureUrl("debug", "neonix-motion-test-10s.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "box-shadow-spread-circle",
    label: "Debug / Box-shadow spread · circle",
    description: "Isolated circle (radius==min(w,h)/2) with a large positive spread - the corner radius must stay self-consistent (a circle stays a circle) after Chrome's OutsetWithCornerCorrection-equivalent geometry growth.",
    url: fixtureUrl("debug", "box-shadow-spread-circle.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "box-shadow-spread-rounded-rect",
    label: "Debug / Box-shadow spread · rounded rect",
    description: "Isolated rounded rect (radius well under min(w,h)/2) with a spread larger than its own radius - proves the unclamped linear growth formula (radius+spread) matches Chrome, since the upper radius clamp can never bind here.",
    url: fixtureUrl("debug", "box-shadow-spread-rounded-rect.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "box-shadow-spread-negative-erode",
    label: "Debug / Box-shadow spread · negative erode",
    description: "Isolated rounded rect with negative spread large enough to drive (radius+spread) below zero - the one regime where clamping is not a no-op, exercising the floor-to-0 corner radius behavior.",
    url: fixtureUrl("debug", "box-shadow-spread-negative-erode.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "box-shadow-offset-x-sweep",
    label: "Debug / Box-shadow offset-x sweep",
    description: "Foundation check: three offset-x values (-60/+20/+120px), offset-y=0, spread=0 - the most basic box-shadow component, isolated from the spread/dilate bug, to prove a clean 1:1 pixel match against Chrome before tackling anything more complex.",
    url: fixtureUrl("debug", "box-shadow-offset-x-sweep.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "box-shadow-offset-y-sweep",
    label: "Debug / Box-shadow offset-y sweep",
    description: "Same foundation check as offset-x, transposed: three offset-y values (-60/+20/+120px), offset-x=0, spread=0.",
    url: fixtureUrl("debug", "box-shadow-offset-y-sweep.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "box-shadow-spread-radius-sweep",
    label: "Debug / Box-shadow spread-radius sweep (plain rect)",
    description: "Foundation check for spread-radius: three spread values (-40/+20/+90px) on a PLAIN rect (cornerRadius:0, no rounding) - a rectangular dilate kernel cannot distort an already axis-aligned rect, so this isolates whether spread itself is correct from the separate, confirmed corner-rounding squircle bug.",
    url: fixtureUrl("debug", "box-shadow-spread-radius-sweep.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "box-shadow-spread-corner-radius-sweep",
    label: "Debug / Box-shadow spread · corner-radius sweep",
    description: "Fixed spread=70px/blur=60px, corner-radius swept 20%/60%/100% of half-side - maps how squircle severity scales with how round the shape already is, complementing the spread-magnitude sweep (which fixed radius at 100% and swept spread instead).",
    url: fixtureUrl("debug", "box-shadow-spread-corner-radius-sweep.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "box-shadow-spread-pill-shape",
    label: "Debug / Box-shadow spread · pill/stadium shape",
    description: "A pill/stadium shape (cornerRadius=height/2) with spread - checks whether only the rounded semicircular end-caps distort while the straight top/bottom edges stay correct, matching common button/badge/tag shapes.",
    url: fixtureUrl("debug", "box-shadow-spread-pill-shape.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "box-shadow-spread-small-scale-icon",
    label: "Debug / Box-shadow spread · small-scale icon",
    description: "A small (60px) icon-scale circle with small spread/blur (12px/8px) - checks whether the squircle bug still matters at common small-UI scale versus the large decorative-orb scale used elsewhere.",
    url: fixtureUrl("debug", "box-shadow-spread-small-scale-icon.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "box-shadow-spread-sharp-rect-isolated",
    label: "Debug / Box-shadow spread · sharp rect isolated",
    description: "The radius:0/spread:90px tile from the spread-radius sweep, alone at full size, to precisely compare corner curvature and extent against Chrome without neighboring tiles crowding the crop.",
    url: fixtureUrl("debug", "box-shadow-spread-sharp-rect-isolated.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "box-shadow-spread-radius-vs-spread-relationship",
    label: "Debug / Box-shadow spread · radius vs spread relationship",
    description: "Fixed spread=90px/blur=40px, cornerRadius swept 0/20/40/60px - checks whether the radius:0 mismatch is a boundary case specific to sharp corners or affects small positive radii too.",
    url: fixtureUrl("debug", "box-shadow-spread-radius-vs-spread-relationship.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "box-shadow-spread-extreme-large-spread",
    label: "Debug / Box-shadow spread · extreme large spread",
    description: "radius:0, blur=40px fixed, spread 100/150/200px - checks whether the radius:0 mismatch grows with spread magnitude (formula/padding) or stays fixed (rounding/AA).",
    url: fixtureUrl("debug", "box-shadow-spread-extreme-large-spread.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "box-shadow-spread-circle-2shadow-list",
    label: "Debug / Box-shadow spread · circle (2-shadow list)",
    description: "Same circle/spread/blur as the circle case, but the shadow is listed twice (identical values) to force routing through the fixed drawBoxEffect path instead of the ordinary single-shadow DropShadow-filter path - isolates the routing bug from the geometry-expansion fix's own correctness.",
    url: fixtureUrl("debug", "box-shadow-spread-circle-2shadow-list.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "box-shadow-spread-circle-magnitude-sweep",
    label: "Debug / Box-shadow spread · circle magnitude sweep",
    description: "Four circles, same blur, spread swept 15/30/50/70px - single (non-list) box-shadows, so all four take the ordinary rectangular-MakeDilate path. Measures how visibly the squircle artifact scales with spread magnitude.",
    url: fixtureUrl("debug", "box-shadow-spread-circle-magnitude-sweep.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "box-shadow-spread-circle-offset",
    label: "Debug / Box-shadow spread · circle with offset",
    description: "Circle with spread AND a non-zero shadow offset (40,40) - checks whether offset composes cleanly with the (buggy) rectangular dilate or introduces further, direction-dependent distortion.",
    url: fixtureUrl("debug", "box-shadow-spread-circle-offset.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "clip-path-shapes",
    label: "Paint / Clip-path shapes",
    description: "inset round, circle, ellipse, polygon (3/5/6 points), path() evenodd hole, and clip-path combined with transform+overflow.",
    url: fixtureUrl("paint", "clip-path-shapes.html"),
    category: "review",
    group: "paint",
    nativeStage: true,
  },
  // --- mask: own catalog ---
  {
    id: "mask",
    label: "Mask / 5 variants",
    description: "Alpha mask (gradient), luminance mask (image), 3-layer add+intersect composite, 2-layer subtract, and mask+clip-path+isolation.",
    url: fixtureUrl("mask", "mask.html"),
    category: "review",
    group: "mask",
    nativeStage: true,
  },
  // --- blend: own catalog ---
  {
    id: "blend-interactions",
    label: "Blend / Interactions",
    description: "Single multiply over a backdrop, sibling blend order, isolation boundary, and blend+opacity+filter stacked together.",
    url: fixtureUrl("blend", "blend-interactions.html"),
    category: "review",
    group: "blend",
    nativeStage: true,
  },
  {
    id: "blend-mode-matrix",
    label: "Blend / Mode matrix (16 modes)",
    description: "A 4x4 grid sweeping every mix-blend-mode value over the same gradient backdrop.",
    url: fixtureUrl("blend", "blend-mode-matrix.html"),
    category: "review",
    group: "blend",
    nativeStage: true,
  },
  // --- layout: own catalog ---
  {
    id: "grid-template-areas",
    label: "Layout / Grid template areas",
    description: "Named grid regions (header/sidebar/main/footer) via grid-template-areas and grid-area.",
    url: fixtureUrl("layout", "grid-template-areas.html"),
    category: "review",
    group: "layout",
    nativeStage: true,
  },
  {
    id: "flex-direction-reverse",
    label: "Layout / Flex-direction reverse",
    description: "flex-direction: row-reverse and column-reverse, each visually reversing DOM order along the main axis.",
    url: fixtureUrl("layout", "flex-direction-reverse.html"),
    category: "review",
    group: "layout",
    nativeStage: true,
  },
  {
    id: "grid-auto-flow",
    label: "Layout / Grid auto-flow",
    description: "The same 5 auto-placed items filling row-major (default) vs grid-auto-flow: column, each growing an implicit 3rd track.",
    url: fixtureUrl("layout", "grid-auto-flow.html"),
    category: "review",
    group: "layout",
    nativeStage: true,
  },
  // --- effect: 11-topic catalog (each fixture = 1 CSS concept, multiple examples inside) ---
  {
    id: "filter-blur",
    label: "Effect / Blur",
    description: "filter: blur() swept across 2px, 6px, 14px, 28px.",
    url: fixtureUrl("effect", "filter-blur.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "filter-brightness",
    label: "Effect / Brightness",
    description: "filter: brightness() swept across 0.5, 1.0, 1.25, 2.0.",
    url: fixtureUrl("effect", "filter-brightness.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "filter-contrast",
    label: "Effect / Contrast",
    description: "filter: contrast() swept across 0.5, 1.0, 1.45, 2.2.",
    url: fixtureUrl("effect", "filter-contrast.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "filter-grayscale",
    label: "Effect / Grayscale",
    description: "filter: grayscale() swept across 0, 0.5, 1 on a gradient box.",
    url: fixtureUrl("effect", "filter-grayscale.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "filter-sepia",
    label: "Effect / Sepia",
    description: "filter: sepia() swept across 0, 0.5, 0.85.",
    url: fixtureUrl("effect", "filter-sepia.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "filter-invert",
    label: "Effect / Invert",
    description: "filter: invert() swept across 0, 0.5, 0.8, 1.",
    url: fixtureUrl("effect", "filter-invert.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "filter-drop-shadow",
    label: "Effect / Drop shadow",
    description: "filter: drop-shadow() variants: offset+blur, zero-blur alpha silhouette, blur-only, offset-only.",
    url: fixtureUrl("effect", "filter-drop-shadow.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "filter-order",
    label: "Effect / Filter order",
    description: "How multiple filters compose: color-filter chain, blur between colors, drop-shadow after blur, filter:opacity() vs layer opacity.",
    url: fixtureUrl("effect", "filter-order.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "box-shadow-outer-glow",
    label: "Effect / Outer glow",
    description: "Outer box-shadow glow: plain, rounded, bordered, offset, spread, and two stacked shadows.",
    url: fixtureUrl("effect", "box-shadow-outer-glow.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "inner-glow",
    label: "Effect / Inner glow",
    description: "Inset box-shadow glow: 4 stroke-radius × halo combinations, a two-shadow stack, and a mask-only isolation case.",
    url: fixtureUrl("effect", "inner-glow.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "combined-glow",
    label: "Effect / Combined glow",
    description: "Outer + inner glow interaction: combined, outer-first order, inner-first order, mixed colors, overlay-only isolation.",
    url: fixtureUrl("effect", "combined-glow.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "backdrop-filter-blur",
    label: "Effect / Backdrop filter blur",
    description: "backdrop-filter: blur() sampling the layers beneath a translucent card (relocated from the perspective catalog — no 3D involved).",
    url: fixtureUrl("effect", "backdrop-filter-blur.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "backdrop-filter-order",
    label: "Effect / Backdrop filter order",
    description: "backdrop-filter: blur() contrast() composing multiple backdrop filters in source order.",
    url: fixtureUrl("effect", "backdrop-filter-order.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "box-shadow-filter",
    label: "Effect / Box-shadow + filter",
    description: "box-shadow alone as a reference, box-shadow + filter: blur(), and 2 box-shadows + filter: brightness() on the same element.",
    url: fixtureUrl("effect", "box-shadow-filter.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "box-shadow-backdrop-filter",
    label: "Effect / Box-shadow + backdrop-filter",
    description: "box-shadow alone as a reference, box-shadow + backdrop-filter: blur(), and the same with border-radius, over a gradient backdrop.",
    url: fixtureUrl("effect", "box-shadow-backdrop-filter.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
];

const CURATED_IDS: ReadonlySet<string> = new Set(CURATED_CASES.map((item) => item.id));

/**
 * Every fixture already registered in the compiler's own fixture registry
 * (`html-compiler-preview.ts`), re-exposed here so native-stage can browse
 * the full fixture tree (not just the hand-curated set above), grouped by
 * its real folder.
 */
const COMPILER_DERIVED_CASES: readonly HtmlPlaygroundCase[] = HTML_COMPILER_PREVIEW_CASES.reduce<HtmlPlaygroundCase[]>(
  (accumulated, item) => {
    if (CURATED_IDS.has(item.id)) return accumulated;
    const group = groupFromFixtureUrl(item.fixtureUrl);
    if (!group) return accumulated;
    accumulated.push({
      id: item.id,
      label: item.label,
      description: item.hint,
      url: item.fixtureUrl,
      category: "review",
      group,
      nativeStage: true,
    });
    return accumulated;
  },
  [],
);

export const HTML_PLAYGROUND_CASES: readonly HtmlPlaygroundCase[] = [
  ...CURATED_CASES,
  ...COMPILER_DERIVED_CASES,
];

export const HTML_PLAYGROUND_NATIVE_CASES = HTML_PLAYGROUND_CASES;

export type HtmlPlaygroundCaseGroupSection = {
  group: HtmlPlaygroundCaseGroup;
  label: string;
  cases: readonly HtmlPlaygroundCase[];
};

/** Groups native-stage cases by rendering concern, in a fixed display order. */
export function htmlPlaygroundCaseGroups(
  cases: readonly HtmlPlaygroundCase[] = HTML_PLAYGROUND_CASES,
): readonly HtmlPlaygroundCaseGroupSection[] {
  return HTML_PLAYGROUND_GROUP_ORDER.map((group) => ({
    group,
    label: HTML_PLAYGROUND_GROUP_LABELS[group],
    cases: cases
      .filter((item) => item.group === group)
      .sort((left, right) =>
        htmlPlaygroundFixturePath(left.url).localeCompare(
          htmlPlaygroundFixturePath(right.url),
          "en",
          { numeric: true, sensitivity: "base" },
        ),
      ),
  })).filter((section) => section.cases.length > 0);
}

/** Returns the fixture's display path below `html-compiler/fixtures`, without `.html`. */
export function htmlPlaygroundFixturePath(url: string): string {
  const prefix = `${HTML_COMPILER_FIXTURE_ROOT}/`;
  const path = url.startsWith(prefix) ? url.slice(prefix.length) : url;
  return path.replace(/\.html$/i, "");
}
