import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import "server-only";
import GithubSlugger from "github-slugger";
import { DocsMarkdown } from "@/components/docs/DocsMarkdown";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export const AI_AUTHORING_LEGACY_SLUGS = [] as const;

export type AiAuthoringSlug = never;

export function isAiAuthoringSlug(_slug: string): _slug is AiAuthoringSlug {
  void _slug;
  return false;
}

function architectureGuidePath(): string {
  return path.join(process.cwd(), "../../docs/guide/v2-architechture.md");
}

function tocFromMarkdown(markdown: string): Array<{ id: string; title: string }> {
  const slugger = new GithubSlugger();
  const items: Array<{ id: string; title: string }> = [];
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^##\s+(.+)$/.exec(line);
    if (!match) continue;
    const title = match[1].trim();
    items.push({ id: slugger.slug(title), title });
  }
  return items;
}

export function getAiAuthoringPage(): DocsPageView {
  const markdown = fs.readFileSync(architectureGuidePath(), "utf8");
  return withOnThisPage({
    title: "V2 architecture",
    toc: tocFromMarkdown(markdown),
    body: createElement(DocsMarkdown, { markdown }),
  });
}
