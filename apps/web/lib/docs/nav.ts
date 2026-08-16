export type DocsNavItem = {
  href: string;
  label: string;
  jsonPath?: string;
};

export type DocsNavGroup = {
  id: string;
  label: string;
  items: DocsNavItem[];
};

export const DOCS_NAV: DocsNavGroup[] = [
  {
    id: "start",
    label: "Getting started",
    items: [
      { href: "/docs", label: "What is Motion JSON?" },
      {
        href: "/docs/how-a-video-is-described",
        label: "How a video is described",
      },
      { href: "/docs/minimal-project", label: "Minimal project" },
      { href: "/docs/ai", label: "AI authoring" },
    ],
  },
  {
    id: "project",
    label: "Project",
    items: [
      { href: "/docs/project", label: "Project" },
      { href: "/docs/timeline", label: "Timeline" },
      { href: "/docs/composition", label: "Composition" },
      { href: "/docs/assets", label: "Assets" },
      { href: "/docs/validation", label: "Validation basics" },
    ],
  },
  {
    id: "layers",
    label: "Layers",
    items: [
      { href: "/docs/layer", label: "What is a layer" },
      { href: "/docs/layers", label: "Layer types overview" },
      { href: "/docs/layers/tree", label: "Layer tree" },
      { href: "/docs/layers/root-zindex", label: "Root layers and zIndex" },
      { href: "/docs/layers/timing", label: "Layer timing" },
      { href: "/docs/frame", label: "Frame" },
      { href: "/docs/layers/text", label: "Text" },
      { href: "/docs/layers/shape", label: "Shape" },
      { href: "/docs/layers/path", label: "Path" },
      { href: "/docs/layers/image", label: "Image" },
      { href: "/docs/layers/svg", label: "SVG" },
      { href: "/docs/layers/video", label: "Video" },
      { href: "/docs/layers/audio", label: "Audio" },
      { href: "/docs/layers/solid", label: "Solid" },
      { href: "/docs/layers/adjustment", label: "Adjustment" },
      { href: "/docs/layers/group", label: "Group" },
      { href: "/docs/layers/layout", label: "Layout" },
      { href: "/docs/layers/component", label: "Component layer" },
    ],
  },
  {
    id: "transform",
    label: "Transform",
    items: [
      { href: "/docs/transform/translate", label: "Translate" },
      { href: "/docs/transform/depth", label: "Depth" },
      { href: "/docs/transform/rotate", label: "Rotate" },
      { href: "/docs/transform/scale", label: "Scale" },
      { href: "/docs/transform/skew", label: "Skew" },
      { href: "/docs/transform/origin", label: "Origin" },
    ],
  },
  {
    id: "appearance",
    label: "Appearance & compositing",
    items: [
      { href: "/docs/appearance/visible", label: "Visible" },
      { href: "/docs/appearance/opacity", label: "Opacity" },
      { href: "/docs/compositing/blend-mode", label: "Blend mode" },
      { href: "/docs/compositing/mask", label: "Mask" },
      { href: "/docs/compositing/isolation", label: "Isolation" },
    ],
  },
  {
    id: "effects",
    label: "Effects",
    items: [
      { href: "/docs/effects/blur", label: "Blur" },
      { href: "/docs/effects/shadow", label: "Shadow" },
      { href: "/docs/effects/glow", label: "Glow" },
      { href: "/docs/effects/color-adjust", label: "Color adjust" },
    ],
  },
  {
    id: "animation",
    label: "Animation",
    items: [
      { href: "/docs/animation/timing", label: "Timing" },
      { href: "/docs/animation/keyframes", label: "Property keyframes" },
      { href: "/docs/animation/easing", label: "Easing" },
      { href: "/docs/animation/audio-fade", label: "Audio fade" },
    ],
  },
  {
    id: "components",
    label: "Components",
    items: [
      { href: "/docs/components", label: "What is a component" },
      { href: "/docs/components/props", label: "Props" },
      { href: "/docs/components/variants", label: "Variants" },
      { href: "/docs/components/bindings", label: "Prop bindings" },
      { href: "/docs/components/nested", label: "Nested components" },
    ],
  },
  {
    id: "examples",
    label: "Examples",
    items: [
      { href: "/docs/examples/text-intro", label: "Text intro" },
      { href: "/docs/examples/image-parallax", label: "Image parallax" },
      { href: "/docs/examples/badge", label: "Badge component" },
      { href: "/docs/examples/invalid", label: "Invalid examples" },
    ],
  },
];

const LEGACY_SLUGS = [
  "preview",
  "transform",
  "appearance",
  "effects",
  "motion",
  "examples",
  "ai/rules",
  "ai/decision-guide",
  "ai/layer-patterns",
  "ai/component-rules",
  "ai/bindings",
  "ai/property-paths",
  "ai/defaults",
  "ai/patterns",
  "ai/error-fixes",
  "ai/patching",
  "ai/naming",
  "ai/checklist",
] as const;

export const DOCS_PAGE_SLUGS = [
  ...new Set([
    "",
    ...DOCS_NAV.flatMap((group) =>
      group.items.map((item) => item.href.replace(/^\/docs\/?/, "")),
    ).filter(Boolean),
    ...LEGACY_SLUGS,
  ]),
];

export type DocsPageSlug = string;

export function docsHref(slug: string): string {
  return slug === "" ? "/docs" : `/docs/${slug}`;
}

export function navLabelForSlug(slug: string): string | undefined {
  const href = docsHref(slug);
  for (const group of DOCS_NAV) {
    const hit = group.items.find((item) => item.href === href);
    if (hit) return hit.label;
  }
  return undefined;
}
