export type DocsEntryStatus = "published" | "planned" | "hidden";
export type DocsSurface =
  | "authoring"
  | "protocol"
  | "runtime"
  | "export"
  | "high-level";

export type DocsEntry = {
  slug: string;
  label: string;
  group: string;
  status: DocsEntryStatus;
  surface: DocsSurface;
};

export type DocsNavItem = {
  href: string;
  label: string;
};

export type DocsNavGroup = {
  id: string;
  label: string;
  items: DocsNavItem[];
};

const published = (
  slug: string,
  label: string,
  group: string,
  surface: DocsSurface,
): DocsEntry => ({ slug, label, group, surface, status: "published" });

const hidden = (slug: string, label: string, surface: DocsSurface): DocsEntry => ({
  slug,
  label,
  group: "hidden",
  surface,
  status: "hidden",
});

/** Public V2 docs only. Source files for hidden concepts remain available. */
export const DOCS_ENTRIES: DocsEntry[] = [
  published("", "Overview", "start", "authoring"),
  published("architecture", "V2 architecture", "start", "authoring"),
  published("authoring", "Authoring model", "start", "authoring"),
  published("ai", "AI and MCP guidance", "start", "authoring"),
  published("atoms", "Atomic Protocol V2", "protocol", "protocol"),
  published("atoms/composition", "Composition and view", "protocol", "protocol"),
  published("atoms/transform", "Transform and Matrix4", "protocol", "protocol"),
  published("atoms/shape", "Shape", "protocol", "protocol"),
  published("atoms/path", "Path", "protocol", "protocol"),
  published("atoms/text", "Text", "protocol", "protocol"),
  published("atoms/image", "Image", "protocol", "protocol"),
  published("atoms/video", "Video", "protocol", "protocol"),
  published("atoms/group", "Group", "protocol", "protocol"),
  published("atoms/effects", "Effects, masks, and composite", "protocol", "protocol"),
  published("rendering", "Runtime, preview, and export", "runtime", "runtime"),
  published("examples", "Static examples", "examples", "authoring"),

  // Reserved high-level vocabulary. Keep the source, but do not publish it yet.
  hidden("components", "Components", "high-level"),
  hidden("components/props", "Component props", "high-level"),
  hidden("components/variants", "Component variants", "high-level"),
  hidden("components/bindings", "Component bindings", "high-level"),
  hidden("components/nested", "Nested components", "high-level"),
];

export const DOCS_NAV: DocsNavGroup[] = [
  { id: "start", label: "Start here", items: [] },
  { id: "protocol", label: "Atomic Protocol V2", items: [] },
  { id: "runtime", label: "Rendering model", items: [] },
  { id: "examples", label: "Examples", items: [] },
].map((group) => ({
  ...group,
  items: DOCS_ENTRIES
    .filter((entry) => entry.status === "published" && entry.group === group.id)
    .map((entry) => ({ href: docsHref(entry.slug), label: entry.label })),
}));

export const DOCS_PAGE_SLUGS = DOCS_ENTRIES
  .filter((entry) => entry.status === "published")
  .map((entry) => entry.slug);

export type DocsPageSlug = (typeof DOCS_PAGE_SLUGS)[number];

export function docsHref(slug: string): string {
  return slug === "" ? "/docs" : `/docs/${slug}`;
}

export function isPublishedDocsSlug(slug: string): slug is DocsPageSlug {
  return DOCS_PAGE_SLUGS.includes(slug as DocsPageSlug);
}

export function isHiddenDocsSlug(slug: string): boolean {
  return DOCS_ENTRIES.some((entry) => entry.slug === slug && entry.status !== "published");
}

export function navLabelForSlug(slug: string): string | undefined {
  return DOCS_ENTRIES.find((entry) => entry.slug === slug && entry.status === "published")?.label;
}
