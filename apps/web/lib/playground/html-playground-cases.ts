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
  {
    id: "bidi-arabic-latin",
    label: "Text / Bidi · Arabic + Latin",
    description: "Embedded Arabic word inside an LTR sentence, a pure RTL Arabic paragraph, and an RTL paragraph with an embedded LTR number - to measure real Chrome bidi reordering against native.",
    url: fixtureUrl("text", "bidi-arabic-latin.html"),
    category: "review",
    group: "text",
    nativeStage: true,
  },
  {
    id: "bidi-hebrew-latin",
    label: "Text / Bidi · Hebrew + Latin",
    description: "Embedded Hebrew word inside an LTR sentence, a pure RTL Hebrew paragraph, and an RTL paragraph with an embedded LTR number - to measure real Chrome bidi reordering against native.",
    url: fixtureUrl("text", "bidi-hebrew-latin.html"),
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
  {
    id: "text-shadow-halo-calibration",
    label: "Paint / Text shadow halo calibration",
    description: "Single isolated red glyph on black with a white text-shadow at 3 blur radii (4/24/40px) - pixel-level halo measurement against real Chrome to calibrate cssShadowBlurRadiusToSkiaSigma().",
    url: fixtureUrl("paint", "text-shadow-halo-calibration.html"),
    category: "review",
    group: "paint",
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
    id: "neonix-ui-transform-showcase",
    label: "Debug / UI transform showcase (16 acts, 0-80s)",
    description: "16 sequential 5s acts (fade, scale pulse, rotate, slide, shake, 3D flip, camera zoom, morph, skew, glitch, wipe/iris, staggered list, progress bar, typewriter, ripple, Ken Burns) - one CSS transform/animation idiom per act, for per-act timing analysis against real Chrome.",
    url: fixtureUrl("debug", "neonix_ui_transform_showcase.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "neonix-physics-path-showcase",
    label: "Debug / Physics + offset-path showcase (13 acts, 0-65s)",
    description: "13 sequential 5s acts of physics-flavored motion (arc, pendulum, elastic wobble, gravity bounce, projectile, sway, spring overshoot, rubber-band snap, orbit, traveling wave) plus offset-path motion (zigzag, spiral, figure-8) - exercises the SVG arc (A) path command end to end.",
    url: fixtureUrl("debug", "neonix_physics_path_showcase.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "neonix-particle-showcase",
    label: "Debug / Particle systems showcase (18 acts)",
    description: "18 acts of particle-driven motion (bursts, fountains, orbiting rings, smooth-cubic offset-path streams, swarms) built from many small offset-path-animated dots - exercises the SVG arc (A) and smooth-cubic (S) path commands at scale (750+ layers).",
    url: fixtureUrl("debug", "neonix_particle_showcase.html"),
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
  // --- box-shadow spread geometry: consolidates 15 former debug/box-shadow-* fixtures ---
  {
    id: "box-shadow-spread-shapes",
    label: "Effect / Box-shadow spread · shapes",
    description: "Blink's OutsetWithCornerCorrection spread geometry across 5 shapes: circle (stays a circle), rounded rect (unclamped linear growth), pill/stadium (only end-caps curve), negative erode (radius floors to 0), and small-scale icon.",
    url: fixtureUrl("effect", "box-shadow-spread-shapes.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "box-shadow-spread-sweeps",
    label: "Effect / Box-shadow spread · magnitude sweeps",
    description: "7 parametric sweeps stacked in one page: offset-x/offset-y, spread on a plain rect, corner-radius, circle spread-magnitude, radius-vs-spread relationship, and extreme large spread.",
    url: fixtureUrl("effect", "box-shadow-spread-sweeps.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "box-shadow-spread-routing",
    label: "Effect / Box-shadow spread · routing",
    description: "The same circle/spread/blur rendered 3 ways - the ordinary single-shadow path, a 2-shadow-list (isolated-mask) path, and spread composed with a non-zero offset - all three must match pixel-for-pixel.",
    url: fixtureUrl("effect", "box-shadow-spread-routing.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "ring-motion-fidelity",
    label: "Effect / Ring · motion fidelity (border + shadow + animated filter + rotation)",
    description: "neonix-motion-test-10s.html's .ring in isolation, real background, real @keyframes (rotate + blur/hue-rotate pulse) running together - consolidates an 8-fixture investigation that found and fixed two real bugs (filter dropped when declared only inside @keyframes; a body's background-image gradient dropped when set as a longhand) and ruled out rotation, border/shadow rendering, and blend-mode compositing as causes of the residual.",
    url: fixtureUrl("effect", "ring-motion-fidelity.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "ring-backdrop-filter-interaction",
    label: "Effect / Ring · behind a backdrop-filter card",
    description: "The ring passing behind a real card at the exact tangent-grazing offset from the real scene, with vs without the card's own box-shadow - checks both backdrop blur sufficiency and whether a card's own box-shadow leaks into its own backdrop-filter capture.",
    url: fixtureUrl("effect", "ring-backdrop-filter-interaction.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "backdrop-filter-rounded-clip-with-children",
    label: "Effect / Backdrop-filter · rounded clip with children",
    description: "Consolidates 3 former debug fixtures for a confirmed, fixed bug: a card with border-radius + backdrop-filter + children showed square corners in CanvasKit. Three variants side by side - rounded-clip baseline, overflow:hidden (an escaping badge must be clipped), and no overflow:hidden (the same badge must NOT be clipped).",
    url: fixtureUrl("effect", "backdrop-filter-rounded-clip-with-children.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "backdrop-filter-small-scale-variants",
    label: "Effect / Backdrop-filter · small card variants (shadow × children)",
    description: "neonix-motion-test-10s.html's 230px feature card in four variants (shadow+children, children only, shadow only, neither) over two bright lines a working backdrop blur must smear - the small scale where the square-corner clip bug (see backdrop-filter-rounded-clip-with-children.html) was originally spotted.",
    url: fixtureUrl("effect", "backdrop-filter-small-scale-variants.html"),
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
