export type HtmlPlaygroundCaseCategory = "review" | "production";

export type HtmlPlaygroundCase = {
  id: string;
  label: string;
  description: string;
  url: string;
  category: HtmlPlaygroundCaseCategory;
  nativeStage: boolean;
};

/** Public directory containing the self-contained HTML compiler fixtures. */
export const PLAYGROUND_HTML_FIXTURE_ROOT = "/playground/fixtures";

const fixtureUrl = (fileName: string) => `${PLAYGROUND_HTML_FIXTURE_ROOT}/${fileName}`;

/**
 * Focused shared fixture set for the regular Playground and native stage.
 * Keep only grid raster controls and the six rounded inset-glow mask controls.
 */
export const HTML_PLAYGROUND_CASES: readonly HtmlPlaygroundCase[] = [
  {
    id: "review-grid-opacity-thirty",
    label: "Review / Grid opacity 30%",
    description: "Grid-only baseline with an explicit opacity: 0.3 compositing boundary and fixed 120px cells.",
    url: fixtureUrl("review-grid-opacity-thirty.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-default-opacity",
    label: "Review / Grid default opacity",
    description: "The same grid without an opacity declaration, isolating default-alpha and cell geometry behavior.",
    url: fixtureUrl("review-grid-default-opacity.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-composition-baseline",
    label: "Review / Grid composition baseline",
    description: "The compositing-baseline grid isolated from shapes, text and effects.",
    url: fixtureUrl("review-grid-composition-baseline.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-composition-baseline-1px",
    label: "Review / Grid baseline with 1px lines",
    description: "A 1px-line variant for native rasterization and edge-pixel inspection.",
    url: fixtureUrl("review-grid-composition-baseline-1px.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-subpixel-01-horizontal",
    label: "Review / Grid 0.1px horizontal",
    description: "A white 0.1px horizontal line in a 120px tile for subpixel coverage measurement.",
    url: fixtureUrl("review-grid-subpixel-01-horizontal.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-subpixel-01-vertical",
    label: "Review / Grid 0.1px vertical",
    description: "A white 0.1px vertical line in a 120px tile for subpixel coverage measurement.",
    url: fixtureUrl("review-grid-subpixel-01-vertical.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-subpixel-025-horizontal",
    label: "Review / Grid 0.25px horizontal",
    description: "A white 0.25px horizontal line in a 120px tile for subpixel coverage measurement.",
    url: fixtureUrl("review-grid-subpixel-025-horizontal.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-subpixel-025-vertical",
    label: "Review / Grid 0.25px vertical",
    description: "A white 0.25px vertical line in a 120px tile for subpixel coverage measurement.",
    url: fixtureUrl("review-grid-subpixel-025-vertical.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-subpixel-05-horizontal",
    label: "Review / Grid 0.5px horizontal",
    description: "A white 0.5px horizontal line in a 120px tile for subpixel coverage measurement.",
    url: fixtureUrl("review-grid-subpixel-05-horizontal.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-subpixel-05-vertical",
    label: "Review / Grid 0.5px vertical",
    description: "A white 0.5px vertical line in a 120px tile for subpixel coverage measurement.",
    url: fixtureUrl("review-grid-subpixel-05-vertical.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-subpixel-1-horizontal",
    label: "Review / Grid 1px horizontal",
    description: "A white 1px horizontal line as the subpixel rasterization control.",
    url: fixtureUrl("review-grid-subpixel-1-horizontal.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-subpixel-1-vertical",
    label: "Review / Grid 1px vertical",
    description: "A white 1px vertical line as the subpixel rasterization control.",
    url: fixtureUrl("review-grid-subpixel-1-vertical.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-short-period-01-horizontal",
    label: "Review / Grid short period 0.1px horizontal",
    description: "A 0.1px horizontal line with the compositing baseline's 8.3333% repeat period.",
    url: fixtureUrl("review-grid-short-period-01-horizontal.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-short-period-01-vertical",
    label: "Review / Grid short period 0.1px vertical",
    description: "A 0.1px vertical line with the compositing baseline's 8.3333% repeat period.",
    url: fixtureUrl("review-grid-short-period-01-vertical.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-long-period-01-both",
    label: "Review / Grid long period 0.1px both",
    description: "Two 0.1px grid layers with a 100% period to isolate multi-layer compositing.",
    url: fixtureUrl("review-grid-long-period-01-both.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-short-period-1-horizontal",
    label: "Review / Grid short period 1px horizontal",
    description: "A 1px horizontal line with the compositing baseline's 8.3333% repeat period.",
    url: fixtureUrl("review-grid-short-period-1-horizontal.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-short-period-1-vertical",
    label: "Review / Grid short period 1px vertical",
    description: "A 1px vertical line with the compositing baseline's 8.3333% repeat period.",
    url: fixtureUrl("review-grid-short-period-1-vertical.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-repeat-x",
    label: "Review / Grid repeat-x",
    description: "A fixed-size CSS background tile repeated horizontally.",
    url: fixtureUrl("review-grid-repeat-x.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-repeat-y",
    label: "Review / Grid repeat-y",
    description: "A fixed-size CSS background tile repeated vertically.",
    url: fixtureUrl("review-grid-repeat-y.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-no-repeat",
    label: "Review / Grid no-repeat",
    description: "A single fixed-size CSS background tile to verify its boundary.",
    url: fixtureUrl("review-grid-no-repeat.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-inset-rounded-small",
    label: "Inset glow / Opaque blur small",
    description: "Opaque black box with 48px radius and white inset shadow(4px).",
    url: fixtureUrl("phase8-inset-rounded-small.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-inset-rounded-medium",
    label: "Inset glow / Opaque blur medium",
    description: "Opaque black box with 48px radius and white inset shadow(18px).",
    url: fixtureUrl("phase8-inset-rounded-medium.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-inset-rounded-large",
    label: "Inset glow / Opaque blur large",
    description: "Opaque black box with 48px radius and white inset shadow(48px).",
    url: fixtureUrl("phase8-inset-rounded-large.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-inset-transparent-rounded-small",
    label: "Inset glow / Transparent radius small",
    description: "Transparent box with 16px radius and white inset shadow(18px).",
    url: fixtureUrl("phase8-inset-transparent-rounded-small.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-inset-transparent-rounded-medium",
    label: "Inset glow / Transparent radius medium",
    description: "Transparent box with 64px radius and white inset shadow(18px).",
    url: fixtureUrl("phase8-inset-transparent-rounded-medium.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-inset-transparent-rounded-large",
    label: "Inset glow / Transparent radius large",
    description: "Transparent box with 112px radius and white inset shadow(18px).",
    url: fixtureUrl("phase8-inset-transparent-rounded-large.html"),
    category: "review",
    nativeStage: true,
  },
] as const;

export const HTML_PLAYGROUND_NATIVE_CASES = HTML_PLAYGROUND_CASES;
