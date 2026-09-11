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
 * Single source of truth for HTML compiler cases.
 *
 * The regular playground exposes every case in this registry. The native
 * stage derives its debug dropdown from the same objects, so a fixture cannot
 * silently drift between the two pages.
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
    description: "The compositing-baseline grid copied into an isolated fixture with no opacity, shapes, text or effects.",
    url: fixtureUrl("review-grid-composition-baseline.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-composition-baseline-1px",
    label: "Review / Grid baseline with 1px lines",
    description: "A 1px-line variant of the composition grid for native rasterization and edge-pixel inspection.",
    url: fixtureUrl("review-grid-composition-baseline-1px.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-repeat-x",
    label: "Review / Grid repeat-x",
    description: "A fixed-size CSS background tile repeated horizontally to verify repeat-x geometry.",
    url: fixtureUrl("review-grid-repeat-x.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-repeat-y",
    label: "Review / Grid repeat-y",
    description: "A fixed-size CSS background tile repeated vertically to verify repeat-y geometry.",
    url: fixtureUrl("review-grid-repeat-y.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-grid-no-repeat",
    label: "Review / Grid no-repeat",
    description: "A single fixed-size CSS background tile to verify the no-repeat boundary.",
    url: fixtureUrl("review-grid-no-repeat.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-pattern-radial-repeat",
    label: "Review / Radial gradient repeat",
    description: "A radial-gradient tile repeated through background-repeat, isolating non-linear paint geometry.",
    url: fixtureUrl("review-pattern-radial-repeat.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-pattern-conic-repeat",
    label: "Review / Conic gradient repeat",
    description: "A conic-gradient tile repeated through background-repeat, isolating sweep-gradient geometry.",
    url: fixtureUrl("review-pattern-conic-repeat.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "review-compositing-baseline-overlap",
    label: "Review / Compositing baseline overlap",
    description: "Static multi-layer baseline for paint order, opacity, rounded geometry and synchronized Inter text.",
    url: fixtureUrl("review-compositing-baseline-overlap.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase2-single-rect",
    label: "Phase 2 / Single rectangle",
    description: "Opaque single rectangle control case for paint geometry and layer count.",
    url: fixtureUrl("phase2-single-rect.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase2-single-opacity",
    label: "Phase 2 / Single opacity",
    description: "One rectangle with opacity 0.3 to isolate a single alpha boundary.",
    url: fixtureUrl("phase2-single-opacity.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase2-rounded-shape",
    label: "Phase 2 / Rounded geometry",
    description: "Rounded rectangle and ellipse controls for border-radius geometry.",
    url: fixtureUrl("phase2-rounded-shape.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase2-two-shape-overlap",
    label: "Phase 2 / Two-shape overlap",
    description: "Two translucent shapes with a controlled overlap for source-over compositing.",
    url: fixtureUrl("phase2-two-shape-overlap.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase2-three-shape-order",
    label: "Phase 2 / Three-shape order",
    description: "Three overlapping shapes with rotation and z-order to verify paint order.",
    url: fixtureUrl("phase2-three-shape-order.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase2-shape-text-image",
    label: "Phase 2 / Shape, text and image",
    description: "A shape, text and inline SVG image sharing one composition for origin alignment.",
    url: fixtureUrl("phase2-shape-text-image.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase2-border-background",
    label: "Phase 2 / Border and background",
    description: "Background, border and outline on one element to detect duplicate paint passes.",
    url: fixtureUrl("phase2-border-background.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase2-multiple-backgrounds",
    label: "Phase 2 / Multiple backgrounds",
    description: "Two authored background layers with independent repeat and size semantics.",
    url: fixtureUrl("phase2-multiple-backgrounds.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "marketing-launch",
    label: "AI / Future systems",
    description: "10-second technology motion graphic with grid, glow, typography and staged reveals.",
    url: fixtureUrl("marketing-launch.html"),
    category: "production",
    nativeStage: false,
  },
  {
    id: "product-story",
    label: "Product launch / Smartphone",
    description: "10-second premium product story with phone depth, feature cards and CTA reveal.",
    url: fixtureUrl("product-story.html"),
    category: "production",
    nativeStage: false,
  },
  {
    id: "creative-brand",
    label: "Creative brand / Motion",
    description: "10-second creative brand film with kinetic type, shapes, motion path and depth cards.",
    url: fixtureUrl("creative-brand.html"),
    category: "production",
    nativeStage: false,
  },
] as const;

export const HTML_PLAYGROUND_NATIVE_CASES = HTML_PLAYGROUND_CASES.filter((fixture) => fixture.nativeStage);
