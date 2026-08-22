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

/** Only the V2 architecture is public while atoms are certified in sequence. */
export const DOCS_NAV: DocsNavGroup[] = [
  {
    id: "v2",
    label: "Protocol V2",
    items: [{ href: "/docs/ai", label: "V2 architecture" }],
  },
];

export const DOCS_PAGE_SLUGS = ["", "ai"] as const;

export type DocsPageSlug = (typeof DOCS_PAGE_SLUGS)[number];

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
