import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { DocsMarkdown } from "@/components/docs/DocsMarkdown";
import type { ReactNode } from "react";

/**
 * Guides are marketing-facing, task-oriented content ("how to create a
 * motion video with X") — separate from /docs, which stays pure technical
 * reference. One .md file per guide, each with its own frontmatter block,
 * unlike the docs catalog files that pack a whole nav group per file.
 */
const CONTENT_ROOT = path.join(process.cwd(), "lib", "guides", "content");

export type GuideSummary = {
  slug: string;
  title: string;
  description: string;
  summary: string;
};

export type GuidePageView = GuideSummary & {
  body: ReactNode;
};

type GuideFile = GuideSummary & { markdown: string; filePath: string };

function parseGuideFile(filePath: string): GuideFile {
  const lines = readFileSync(filePath, "utf8").replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "---") {
    throw new Error(`${filePath}: expected a frontmatter block starting at line 1.`);
  }
  const fields: Record<string, string> = {};
  let i = 1;
  while (i < lines.length && lines[i] !== "---") {
    const colon = lines[i].indexOf(":");
    if (colon !== -1) fields[lines[i].slice(0, colon)] = lines[i].slice(colon + 1).trimStart();
    i += 1;
  }
  i += 1;
  const bodyLines = lines.slice(i);
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === "") bodyLines.pop();

  const { slug, title, description, summary } = fields;
  if (!slug || !title || !description) {
    throw new Error(`${filePath}: guide frontmatter needs slug, title, and description.`);
  }
  return { slug, title, description, summary: summary ?? description, markdown: bodyLines.join("\n"), filePath };
}

let cache: Map<string, GuideFile> | null = null;

function loadGuides(): Map<string, GuideFile> {
  if (cache) return cache;
  const files = readdirSync(CONTENT_ROOT)
    .filter((name) => name.endsWith(".md"))
    .sort();
  const guides = new Map<string, GuideFile>();
  for (const name of files) {
    const guide = parseGuideFile(path.join(CONTENT_ROOT, name));
    guides.set(guide.slug, guide);
  }
  cache = guides;
  return guides;
}

export function getGuideSlugs(): string[] {
  return Array.from(loadGuides().keys());
}

export function listGuides(): GuideSummary[] {
  return Array.from(loadGuides().values()).map(({ slug, title, description, summary }) => ({
    slug,
    title,
    description,
    summary,
  }));
}

export function getGuidePage(slug: string): GuidePageView | null {
  const guide = loadGuides().get(slug);
  if (!guide) return null;
  return {
    slug: guide.slug,
    title: guide.title,
    description: guide.description,
    summary: guide.summary,
    body: createElement(DocsMarkdown, { markdown: guide.markdown }),
  };
}

export function getGuideLastModified(slug: string): Date | null {
  const guide = loadGuides().get(slug);
  if (!guide) return null;
  try {
    return statSync(guide.filePath).mtime;
  } catch {
    return null;
  }
}
