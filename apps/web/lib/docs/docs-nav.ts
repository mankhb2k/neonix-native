export type DocsEntryStatus = "published" | "planned" | "hidden";
export type DocsSurface =
  | "authoring"
  | "protocol"
  | "runtime"
  | "export"
  | "high-level"
  | "mcp";

export type DocsEntry = {
  slug: string;
  label: string;
  group: string;
  status: DocsEntryStatus;
  surface: DocsSurface;
};

export type DocsNavItem = { href: string; label: string };
export type DocsNavGroup = {
  id: string;
  label: string;
  description?: string;
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

export const DOCS_ENTRIES: DocsEntry[] = [
  published("", "Overview", "start", "authoring"),
  published("authoring", "Authoring model", "start", "authoring"),
  published("atoms", "Neonix JSON V2", "protocol", "protocol"),
  published("atoms/composition", "Composition and view", "protocol", "protocol"),
  published("atoms/assets", "Assets", "protocol", "protocol"),
  published("atoms/layers", "Layers and hierarchy", "protocol", "protocol"),
  published("atoms/transform", "Transform and Matrix4", "protocol", "protocol"),
  published("atoms/shape", "Shape", "protocol", "protocol"),
  published("atoms/path", "Path", "protocol", "protocol"),
  published("atoms/text", "Text", "protocol", "protocol"),
  published("atoms/image", "Image", "protocol", "protocol"),
  published("atoms/video", "Video", "protocol", "protocol"),
  published("atoms/group", "Group", "protocol", "protocol"),
  published("atoms/paint", "Paint and SVG definitions", "visual", "protocol"),
  published("atoms/effects", "Masks, filters, and effects", "visual", "protocol"),
  published("animation", "Animation and timing", "animation", "protocol"),
  published("animation/motion-paths", "Motion paths", "animation", "protocol"),
  published("audio", "Audio", "animation", "protocol"),
  published("compiler", "Compiler", "runtime", "runtime"),
  published("html", "HTML authoring", "runtime", "runtime"),
  published("rendering", "Output", "runtime", "runtime"),
  published("validation", "Validation and schema", "runtime", "protocol"),
  published("examples", "Static examples", "examples", "authoring"),
  published("examples/project", "Complete project", "examples", "authoring"),
  published("mcp", "Overview", "mcp", "mcp"),
  published("mcp/chatgpt", "ChatGPT", "mcp", "mcp"),
  published("mcp/claude", "Claude", "mcp", "mcp"),
  published("mcp/grok", "Grok", "mcp", "mcp"),
  published("mcp/claude-code", "Claude Code", "mcp", "mcp"),
  published("mcp/codex", "Codex", "mcp", "mcp"),
  published("mcp/cursor", "Cursor", "mcp", "mcp"),
  published("mcp/antigravity", "Antigravity", "mcp", "mcp"),
  hidden("components", "Components", "high-level"),
  hidden("components/props", "Component props", "high-level"),
  hidden("components/variants", "Component variants", "high-level"),
  hidden("components/bindings", "Component bindings", "high-level"),
  hidden("components/nested", "Nested components", "high-level"),
];

function docsHref(slug: string): string {
  return slug === "" ? "/docs" : `/docs/${slug}`;
}

export const DOCS_NAV: DocsNavGroup[] = [
  { id: "start", label: "Start here", description: "Understand the model", items: [] },
  { id: "protocol", label: "Neonix JSON V2", description: "The JSON contract", items: [] },
  { id: "animation", label: "Animation system", description: "Time, tracks and paths", items: [] },
  { id: "visual", label: "Visual semantics", description: "Paint, masks and effects", items: [] },
  { id: "runtime", label: "Authoring tools", description: "Compile, validate and export", items: [] },
  { id: "examples", label: "Examples", description: "Put the pieces together", items: [] },
  { id: "mcp", label: "MCP", description: "Connect your AI clients", items: [] },
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

export function isHiddenDocsSlug(slug: string): boolean {
  return DOCS_ENTRIES.some((entry) => entry.slug === slug && entry.status !== "published");
}

export type DocsBreadcrumbItem = { name: string; href: string };

function firstPublishedSlugInGroup(group: string): string | undefined {
  return DOCS_ENTRIES.find((entry) => entry.status === "published" && entry.group === group)?.slug;
}

/**
 * Docs > {nav group} > {page}, collapsing the group level when the slug
 * itself is the group's own landing entry (e.g. "atoms" for Neonix JSON V2).
 */
export function getDocsBreadcrumb(slug: string): DocsBreadcrumbItem[] {
  const entry = DOCS_ENTRIES.find((item) => item.slug === slug && item.status === "published");
  if (!entry) return [];
  const navGroup = DOCS_NAV.find((group) => group.id === entry.group);
  const anchorSlug = firstPublishedSlugInGroup(entry.group);
  const trail: DocsBreadcrumbItem[] = [{ name: "Docs", href: "/docs" }];
  if (navGroup && anchorSlug !== undefined) {
    trail.push({ name: navGroup.label, href: docsHref(anchorSlug) });
  }
  if (anchorSlug !== slug) {
    trail.push({ name: entry.label, href: docsHref(slug) });
  }
  return trail;
}
