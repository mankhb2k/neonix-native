import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import GithubSlugger from "github-slugger";
import { createElement } from "react";
import { DocsMarkdown } from "@/app/(marketing)/docs/_components/DocsMarkdown";
import { DocsOverview } from "@/app/(marketing)/docs/_components/DocsOverview";
import { DOCS_ENTRIES, DOCS_NAV } from "@/lib/docs/docs-nav";
import type { ReactNode } from "react";

export type {
  DocsBreadcrumbItem,
  DocsEntry,
  DocsEntryStatus,
  DocsNavGroup,
  DocsNavItem,
  DocsPageSlug,
  DocsSurface,
} from "@/lib/docs/docs-nav";
export { DOCS_ENTRIES, DOCS_NAV, DOCS_PAGE_SLUGS, getDocsBreadcrumb, isHiddenDocsSlug } from "@/lib/docs/docs-nav";

export type DocsPageView = {
  title: string;
  description?: string;
  toc: Array<{ id: string; title: string }>;
  showToc?: boolean;
  previewProject?: unknown;
  body: ReactNode;
};

function withOnThisPage(page: DocsPageView): DocsPageView {
  return { ...page, showToc: page.showToc ?? true };
}

type V2Page = { title: string; description: string; markdown: string };

const CONTENT_ROOT = path.join(process.cwd(), "lib", "docs", "content");

const GROUP_BY_SLUG = new Map(DOCS_ENTRIES.map((entry) => [entry.slug, entry.group]));

function kebabCase(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Catalog file names mirror the sidebar's nav group labels (e.g. "Neonix JSON V2" -> neonix-json-v2.md).
const CATALOG_FILE_NAME_BY_GROUP = new Map(DOCS_NAV.map((group) => [group.id, kebabCase(group.label)]));

function catalogFilePath(group: string): string {
  const fileName = CATALOG_FILE_NAME_BY_GROUP.get(group) ?? group;
  return path.join(CONTENT_ROOT, `${fileName}.md`);
}

/**
 * One catalog file holds every page in a nav group, each as its own
 * `---\nslug: ...\ntitle: ...\ndescription: ...\n---` block followed by that
 * page's markdown body, up to the next block or end of file.
 */
function parseCatalogFile(raw: string): Map<string, V2Page> {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const pages = new Map<string, V2Page>();
  let i = 0;
  while (i < lines.length) {
    if (lines[i] === "") {
      i += 1;
      continue;
    }
    if (lines[i] !== "---") throw new Error(`Expected a frontmatter block at line ${i + 1}.`);
    i += 1;
    const fields: Record<string, string> = {};
    while (i < lines.length && lines[i] !== "---") {
      const colon = lines[i].indexOf(":");
      if (colon !== -1) fields[lines[i].slice(0, colon)] = lines[i].slice(colon + 1).trimStart();
      i += 1;
    }
    i += 1;
    const bodyLines: string[] = [];
    while (i < lines.length && lines[i] !== "---") {
      bodyLines.push(lines[i]);
      i += 1;
    }
    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === "") bodyLines.pop();
    pages.set(fields.slug ?? "", {
      title: fields.title ?? "",
      description: fields.description ?? "",
      markdown: bodyLines.join("\n"),
    });
  }
  return pages;
}

const catalogCache = new Map<string, Map<string, V2Page>>();

function loadCatalog(group: string): Map<string, V2Page> {
  const cached = catalogCache.get(group);
  if (cached) return cached;
  const filePath = catalogFilePath(group);
  const pages = existsSync(filePath) ? parseCatalogFile(readFileSync(filePath, "utf8")) : new Map<string, V2Page>();
  catalogCache.set(group, pages);
  return pages;
}

function loadV2Page(slug: string): V2Page | null {
  const group = GROUP_BY_SLUG.get(slug);
  if (!group) return null;
  return loadCatalog(group).get(slug) ?? null;
}

function tocFromMarkdown(markdown: string): Array<{ id: string; title: string }> {
  const slugger = new GithubSlugger();
  return markdown.split(/\r?\n/).flatMap((line) => {
    const match = /^##\s+(.+)$/.exec(line);
    if (!match) return [];
    const title = match[1].trim();
    return [{ id: slugger.slug(title), title }];
  });
}

export function getV2DocsPage(slug: string): DocsPageView | null {
  const page = loadV2Page(slug);
  if (!page) return null;
  return withOnThisPage({
    title: page.title,
    description: page.description,
    toc: tocFromMarkdown(page.markdown),
    body: slug === "" ? createElement(DocsOverview) : createElement(DocsMarkdown, { markdown: page.markdown }),
  });
}

export function getDocsPage(slug: string): DocsPageView {
  const page = getV2DocsPage(slug);
  if (!page) throw new Error(`Unknown published documentation slug: ${slug}`);
  return page;
}

/** The catalog file backing a slug's content, for callers that need its on-disk mtime (e.g. the sitemap). */
export function getDocsContentFilePath(slug: string): string | null {
  const group = GROUP_BY_SLUG.get(slug);
  return group ? catalogFilePath(group) : null;
}

export function getDocsLastModified(slug: string): Date | null {
  const filePath = getDocsContentFilePath(slug);
  if (!filePath) return null;
  try {
    return statSync(filePath).mtime;
  } catch {
    return null;
  }
}
