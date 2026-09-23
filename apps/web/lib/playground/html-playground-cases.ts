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
  // --- effect debug: individual fixtures pinned by automated regression tests ---
  {
    id: "inset-stroke-rounded-medium-halo-medium",
    label: "Debug / Inset glow · radius medium · halo medium (pinned regression)",
    description: "8px solid stroke, 64px radius and white inset shadow(18px); pinned by the alpha-mask effect-box geometry unit test.",
    url: fixtureUrl("debug", "inset-stroke-rounded-medium-halo-medium.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "inset-stroke-rounded-medium-halo-large",
    label: "Debug / Inset glow · radius medium · halo large (pinned regression)",
    description: "8px solid stroke, 64px radius and white inset shadow(48px); pinned by the alpha-mask effect-box geometry unit test.",
    url: fixtureUrl("debug", "inset-stroke-rounded-medium-halo-large.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "inset-stroke-rounded-large-halo-medium",
    label: "Debug / Inset glow · radius large · halo medium (pinned regression)",
    description: "8px solid stroke, 112px radius and white inset shadow(18px); pinned by the alpha-mask effect-box geometry unit test.",
    url: fixtureUrl("debug", "inset-stroke-rounded-large-halo-medium.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "inset-stroke-rounded-large-halo-large",
    label: "Debug / Inset glow · radius large · halo large (pinned regression)",
    description: "8px solid stroke, 112px radius and white inset shadow(48px); pinned by the alpha-mask effect-box geometry unit test.",
    url: fixtureUrl("debug", "inset-stroke-rounded-large-halo-large.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "outer-glow-plain",
    label: "Debug / Outer glow plain (pinned regression)",
    description: "Full-stage plain outer glow, pinned by the shadow-comparison pixel-diff regression test.",
    url: fixtureUrl("debug", "outer-glow-plain.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "outer-glow-stack",
    label: "Debug / Outer glow two-shadow stack (pinned regression)",
    description: "Full-stage two-shadow outer glow, pinned by an exact effect-box geometry unit test and the pixel-diff regression test.",
    url: fixtureUrl("debug", "outer-glow-stack.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "outer-glow-spread",
    label: "Debug / Outer glow spread (runtime diagnostic)",
    description: "Full-stage outer glow with spread, kept as a standalone runtime diagnostic fixture.",
    url: fixtureUrl("debug", "outer-glow-spread.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "outer-glow-overlay-only",
    label: "Debug / Outer glow overlay-only (pinned regression)",
    description: "Black owner with one white outer shadow to isolate the shadow-only overlay; pinned by the pixel-diff regression test.",
    url: fixtureUrl("debug", "outer-glow-overlay-only.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "inner-glow-mask-only",
    label: "Debug / Inner glow mask-only (pinned regression)",
    description: "Black owner with one white inset shadow to isolate source-mask subtraction; pinned by the pixel-diff regression test.",
    url: fixtureUrl("debug", "inner-glow-mask-only.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "mixed-glow-order-colors",
    label: "Debug / Mixed glow color order (pinned regression)",
    description: "Red outer and white inset shadows expose branch order and independent masks; pinned by the pixel-diff regression test.",
    url: fixtureUrl("debug", "mixed-glow-order-colors.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "inner-outer-glow-order",
    label: "Debug / Inner + outer glow order (pinned regression)",
    description: "Inset glow followed by outer glow to test reversed ordering; pinned by the pixel-diff regression test.",
    url: fixtureUrl("debug", "inner-outer-glow-order.html"),
    category: "review",
    group: "debug",
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
