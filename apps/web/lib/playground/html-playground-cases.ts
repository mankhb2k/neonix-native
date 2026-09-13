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
 * Focused Phase 8 matrix for the border/stroke + inset-glow interaction.
 * The two radius values are crossed with the two halo values so mask geometry
 * and blur width can be compared independently.
 */
export const HTML_PLAYGROUND_CASES: readonly HtmlPlaygroundCase[] = [
  {
    id: "phase8-inset-stroke-rounded-medium-halo-medium",
    label: "Inset glow / Stroke radius medium · halo medium",
    description: "8px solid stroke, 64px radius and white inset shadow(18px).",
    url: fixtureUrl("phase8-inset-stroke-rounded-medium-halo-medium.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-inset-stroke-rounded-medium-halo-large",
    label: "Inset glow / Stroke radius medium · halo large",
    description: "8px solid stroke, 64px radius and white inset shadow(48px).",
    url: fixtureUrl("phase8-inset-stroke-rounded-medium-halo-large.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-inset-stroke-rounded-large-halo-medium",
    label: "Inset glow / Stroke radius large · halo medium",
    description: "8px solid stroke, 112px radius and white inset shadow(18px).",
    url: fixtureUrl("phase8-inset-stroke-rounded-large-halo-medium.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-inset-stroke-rounded-large-halo-large",
    label: "Inset glow / Stroke radius large · halo large",
    description: "8px solid stroke, 112px radius and white inset shadow(48px).",
    url: fixtureUrl("phase8-inset-stroke-rounded-large-halo-large.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-outer-glow-plain",
    label: "Outer glow / Plain box",
    description: "White outer glow, no radius, border, offset or spread.",
    url: fixtureUrl("phase8-outer-glow-plain.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-outer-glow-rounded",
    label: "Outer glow / Rounded box",
    description: "White outer glow on a 64px rounded box.",
    url: fixtureUrl("phase8-outer-glow-rounded.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-outer-glow-border",
    label: "Outer glow / Border",
    description: "White outer glow around an 8px bordered box.",
    url: fixtureUrl("phase8-outer-glow-border.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-outer-glow-offset",
    label: "Outer glow / Offset",
    description: "White outer glow with an 18px by 12px offset.",
    url: fixtureUrl("phase8-outer-glow-offset.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-outer-inner-glow-combined",
    label: "Outer + inner glow / Combined",
    description: "White outer and inset glows on one rounded box.",
    url: fixtureUrl("phase8-outer-inner-glow-combined.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-outer-glow-stack",
    label: "Outer glow / Two shadows",
    description: "Two white outer glows with different blur radii.",
    url: fixtureUrl("phase8-outer-glow-stack.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-inner-glow-stack",
    label: "Inner glow / Two shadows",
    description: "Two white inset glows with different blur radii.",
    url: fixtureUrl("phase8-inner-glow-stack.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-outer-inner-glow-order",
    label: "Outer + inner glow / Outer first",
    description: "Outer glow followed by inset glow to test ordered compositing.",
    url: fixtureUrl("phase8-outer-inner-glow-order.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-inner-outer-glow-order",
    label: "Inner + outer glow / Inner first",
    description: "Inset glow followed by outer glow to test reversed ordering.",
    url: fixtureUrl("phase8-inner-outer-glow-order.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-outer-glow-overlay-only",
    label: "Core / Outer glow overlay-only",
    description: "Black owner with one white outer shadow to isolate the shadow-only overlay.",
    url: fixtureUrl("phase8-outer-glow-overlay-only.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-inner-glow-mask-only",
    label: "Core / Inner glow mask-only",
    description: "Black owner with one white inset shadow to isolate source-mask subtraction.",
    url: fixtureUrl("phase8-inner-glow-mask-only.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-mixed-glow-order-colors",
    label: "Core / Mixed glow color order",
    description: "Red outer and white inset shadows expose branch order and independent masks.",
    url: fixtureUrl("phase8-mixed-glow-order-colors.html"),
    category: "review",
    nativeStage: true,
  },
  {
    id: "phase8-outer-glow-spread",
    label: "Outer glow / Spread",
    description: "White outer glow with a 12px spread for runtime diagnostics.",
    url: fixtureUrl("phase8-outer-glow-spread.html"),
    category: "review",
    nativeStage: true,
  },
] as const;

export const HTML_PLAYGROUND_NATIVE_CASES = HTML_PLAYGROUND_CASES;
