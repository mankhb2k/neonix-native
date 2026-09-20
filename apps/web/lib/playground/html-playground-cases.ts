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
  | "text"
  | "effect"
  | "layout"
  | "perspective"
  | "motion"
  | "typography"
  | "texture"
  | "tags"
  | "geometry"
  | "media"
  | "opacity"
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
  "text",
  "effect",
  "layout",
  "perspective",
  "motion",
  "typography",
  "texture",
  "tags",
  "geometry",
  "media",
  "opacity",
  "transform",
  "neonix",
  "svg",
];

export const HTML_PLAYGROUND_GROUP_LABELS: Record<HtmlPlaygroundCaseGroup, string> = {
  debug: "Debug",
  paint: "Paint",
  text: "Text",
  effect: "Effect",
  layout: "Layout",
  perspective: "Perspective",
  motion: "Motion",
  typography: "Typography",
  texture: "Texture",
  tags: "Tags",
  geometry: "Geometry",
  media: "Media",
  opacity: "Opacity",
  transform: "Transform",
  neonix: "Neonix",
  svg: "SVG",
};

const HTML_PLAYGROUND_GROUP_SET: ReadonlySet<string> = new Set(HTML_PLAYGROUND_GROUP_ORDER);

/** Reads the fixture's folder segment straight off its URL, so grouping can never drift from where the file actually lives. */
function groupFromFixtureUrl(url: string): HtmlPlaygroundCaseGroup | null {
  const prefix = `${HTML_COMPILER_FIXTURE_ROOT}/`;
  if (!url.startsWith(prefix)) return null;
  const rest = url.slice(prefix.length);
  const slashIndex = rest.indexOf("/");
  if (slashIndex === -1) return null; // Fixture sits at the tree root, outside any category folder.
  const folder = rest.slice(0, slashIndex);
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
  {
    id: "debug-border-dashed-rounded-radius-sweep",
    label: "Debug / Rounded dashed radius sweep",
    description: "Fixed box+width, radius 0/20/64/120/150, to see how the strokeDash rhythm behaves as border-radius grows toward a pill shape.",
    url: fixtureUrl("debug", "border-dashed-rounded-radius-sweep.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "debug-border-dashed-rounded-width-sweep",
    label: "Debug / Rounded dashed width sweep",
    description: "Fixed box+radius, border-width 10/20/40/80, to check whether the unit=2xwidth rule still holds on a curved perimeter.",
    url: fixtureUrl("debug", "border-dashed-rounded-width-sweep.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "debug-border-dashed-rounded-size-sweep",
    label: "Debug / Rounded dashed size sweep",
    description: "Fixed radius+width+aspect ratio, overall box size (and perimeter) varies, to test how dash count scales with a closed rounded perimeter.",
    url: fixtureUrl("debug", "border-dashed-rounded-size-sweep.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "debug-border-dotted-rounded-radius-sweep",
    label: "Debug / Rounded dotted radius sweep",
    description: "Dotted counterpart of the dashed radius sweep.",
    url: fixtureUrl("debug", "border-dotted-rounded-radius-sweep.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "debug-border-dashed-rounding-boundary",
    label: "Debug / Dashed N rounding boundary",
    description: "Single-edge dashed borders at exact N/N+1 rounding boundaries, to pin down Chrome's exact rounding rule for dash count.",
    url: fixtureUrl("debug", "border-dashed-rounding-boundary.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "debug-border-dashed-width-formula-check",
    label: "Debug / Dashed width formula check",
    description: "Fixed 600px edge, border-width 10/20/40/80px, to confirm the dash-count formula scales correctly with width alone.",
    url: fixtureUrl("debug", "border-dashed-width-formula-check.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "debug-border-corner-miter-baseline",
    label: "Debug / Corner miter baseline (solid, 4 colors)",
    description: "4 different border colors per side reveal the exact corner miter line for symmetric and asymmetric border-widths, with no dash involved.",
    url: fixtureUrl("debug", "border-corner-miter-baseline.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "debug-border-corner-dashed-zoom",
    label: "Debug / Corner dashed zoom",
    description: "Thick dashed border with few large dash runs per edge, isolating the corner-clip geometry bug at readable pixel scale.",
    url: fixtureUrl("debug", "border-corner-dashed-zoom.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "debug-border-corner-dotted-zoom",
    label: "Debug / Corner dotted zoom",
    description: "Thick dotted border with few large dot runs per edge, isolating the corner dot placement at readable pixel scale.",
    url: fixtureUrl("debug", "border-corner-dotted-zoom.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "debug-border-style-width-sweep",
    label: "Debug / Border dash-dot width sweep",
    description: "Same box, varying border-width (2-32px) for dashed/dotted, to probe whether the dash/dot rhythm scales with width like the real browser.",
    url: fixtureUrl("debug", "border-style-width-sweep.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "debug-border-style-edge-length-sweep",
    label: "Debug / Border dash-dot edge-length sweep",
    description: "Fixed border-width, varying edge length at awkward (non-period-multiple) values, to probe the whole-run-count rounding rule.",
    url: fixtureUrl("debug", "border-style-edge-length-sweep.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "debug-border-style-radius-sweep",
    label: "Debug / Border dash-dot radius sweep",
    description: "Fixed border-width, sweeping corner radius across the boundary between the no-radius polygon algorithm and the radius stroke-dash algorithm.",
    url: fixtureUrl("debug", "border-style-radius-sweep.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "debug-svg-dasharray-sweep",
    label: "Debug / SVG stroke-dasharray sweep",
    description: "Six dasharray/dashoffset/linecap variations on straight lines to verify CanvasKit's PathEffect.MakeDash matches the browser exactly.",
    url: fixtureUrl("debug", "svg-dasharray-sweep.html"),
    category: "review",
    group: "debug",
    nativeStage: true,
  },
  {
    id: "paint-stroke-dash-rotated",
    label: "Stroke dash (rotated)",
    description: "Thin dashed border on a rotated box to exercise stroke cap/join at non-axis angles.",
    url: fixtureUrl("paint", "stroke-dash-rotated.html"),
    category: "review",
    group: "paint",
    nativeStage: true,
  },
  {
    id: "inset-stroke-rounded-medium-halo-medium",
    label: "Inset glow / Stroke radius medium · halo medium",
    description: "8px solid stroke, 64px radius and white inset shadow(18px).",
    url: fixtureUrl("effect", "inset-stroke-rounded-medium-halo-medium.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "inset-stroke-rounded-medium-halo-large",
    label: "Inset glow / Stroke radius medium · halo large",
    description: "8px solid stroke, 64px radius and white inset shadow(48px).",
    url: fixtureUrl("effect", "inset-stroke-rounded-medium-halo-large.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "inset-stroke-rounded-large-halo-medium",
    label: "Inset glow / Stroke radius large · halo medium",
    description: "8px solid stroke, 112px radius and white inset shadow(18px).",
    url: fixtureUrl("effect", "inset-stroke-rounded-large-halo-medium.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "inset-stroke-rounded-large-halo-large",
    label: "Inset glow / Stroke radius large · halo large",
    description: "8px solid stroke, 112px radius and white inset shadow(48px).",
    url: fixtureUrl("effect", "inset-stroke-rounded-large-halo-large.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "outer-glow-plain",
    label: "Outer glow / Plain box",
    description: "White outer glow, no radius, border, offset or spread.",
    url: fixtureUrl("effect", "outer-glow-plain.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "outer-glow-rounded",
    label: "Outer glow / Rounded box",
    description: "White outer glow on a 64px rounded box.",
    url: fixtureUrl("effect", "outer-glow-rounded.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "outer-glow-border",
    label: "Outer glow / Border",
    description: "White outer glow around an 8px bordered box.",
    url: fixtureUrl("effect", "outer-glow-border.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "outer-glow-offset",
    label: "Outer glow / Offset",
    description: "White outer glow with an 18px by 12px offset.",
    url: fixtureUrl("effect", "outer-glow-offset.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "outer-inner-glow-combined",
    label: "Outer + inner glow / Combined",
    description: "White outer and inset glows on one rounded box.",
    url: fixtureUrl("effect", "outer-inner-glow-combined.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "outer-glow-stack",
    label: "Outer glow / Two shadows",
    description: "Two white outer glows with different blur radii.",
    url: fixtureUrl("effect", "outer-glow-stack.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "inner-glow-stack",
    label: "Inner glow / Two shadows",
    description: "Two white inset glows with different blur radii.",
    url: fixtureUrl("effect", "inner-glow-stack.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "outer-inner-glow-order",
    label: "Outer + inner glow / Outer first",
    description: "Outer glow followed by inset glow to test ordered compositing.",
    url: fixtureUrl("effect", "outer-inner-glow-order.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "inner-outer-glow-order",
    label: "Inner + outer glow / Inner first",
    description: "Inset glow followed by outer glow to test reversed ordering.",
    url: fixtureUrl("effect", "inner-outer-glow-order.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "outer-glow-overlay-only",
    label: "Core / Outer glow overlay-only",
    description: "Black owner with one white outer shadow to isolate the shadow-only overlay.",
    url: fixtureUrl("effect", "outer-glow-overlay-only.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "inner-glow-mask-only",
    label: "Core / Inner glow mask-only",
    description: "Black owner with one white inset shadow to isolate source-mask subtraction.",
    url: fixtureUrl("effect", "inner-glow-mask-only.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "mixed-glow-order-colors",
    label: "Core / Mixed glow color order",
    description: "Red outer and white inset shadows expose branch order and independent masks.",
    url: fixtureUrl("effect", "mixed-glow-order-colors.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
  {
    id: "outer-glow-spread",
    label: "Outer glow / Spread",
    description: "White outer glow with a 12px spread for runtime diagnostics.",
    url: fixtureUrl("effect", "outer-glow-spread.html"),
    category: "review",
    group: "effect",
    nativeStage: true,
  },
];

const CURATED_IDS: ReadonlySet<string> = new Set(CURATED_CASES.map((item) => item.id));

/**
 * Every fixture already registered for the compiler's own `/docs/preview`
 * lab, re-exposed here so native-stage can browse the full fixture tree
 * (not just the hand-curated set above), grouped by its real folder.
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
    cases: cases.filter((item) => item.group === group),
  })).filter((section) => section.cases.length > 0);
}
