import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import "server-only";
import GithubSlugger from "github-slugger";
import { DocsMarkdown } from "@/components/docs/DocsMarkdown";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

const SECTION_FILES = [
  "authoring-rules.md",
  "decision-guide.md",
  "layer-authoring-patterns.md",
  "component-authoring-rules.md",
  "binding-and-variables-rules.md",
  "canonical-property-paths.md",
  "defaults-and-ranges.md",
  "valid-and-invalid-patterns.md",
  "common-error-fixes.md",
  "patching-existing-projects.md",
  "naming-and-id-conventions.md",
  "ai-output-checklist.md",
] as const;

const LEGACY_HREF_TO_HASH: Array<[string, string]> = [
  ["/docs/ai/decision-guide", "decision-guide"],
  ["/docs/ai/layer-patterns", "layer-authoring-patterns"],
  ["/docs/ai/component-rules", "component-authoring-rules"],
  ["/docs/ai/property-paths", "canonical-property-paths"],
  ["/docs/ai/error-fixes", "common-error-fixes"],
  ["/docs/ai/patching", "patching-existing-projects"],
  ["/docs/ai/checklist", "ai-output-checklist"],
  ["/docs/ai/bindings", "binding-and-variables-rules"],
  ["/docs/ai/patterns", "valid-and-invalid-patterns"],
  ["/docs/ai/defaults", "defaults-and-ranges"],
  ["/docs/ai/naming", "naming-and-id-conventions"],
  ["/docs/ai/rules", "authoring-rules"],
];

export const AI_AUTHORING_LEGACY_SLUGS = [
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

export type AiAuthoringSlug = (typeof AI_AUTHORING_LEGACY_SLUGS)[number];

export function isAiAuthoringSlug(slug: string): slug is AiAuthoringSlug {
  return (AI_AUTHORING_LEGACY_SLUGS as readonly string[]).includes(slug);
}

function aiAuthoringDir(): string {
  return path.join(process.cwd(), "../../docs/guide/ai-authoring");
}

function demoteHeadings(markdown: string): string {
  const lines: string[] = [];
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("```")) {
      inFence = !inFence;
      lines.push(line);
      continue;
    }
    if (!inFence && /^#{1,5}\s/.test(line)) {
      lines.push(`#${line}`);
      continue;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function rewriteAiLinks(markdown: string): string {
  let next = markdown;
  for (const [href, hash] of LEGACY_HREF_TO_HASH) {
    next = next.replaceAll(href, `/docs/ai#${hash}`);
  }
  return next;
}

function tocFromMarkdown(
  markdown: string,
): Array<{ id: string; title: string }> {
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

function loadCombinedMarkdown(): string {
  const dir = aiAuthoringDir();
  const sections = SECTION_FILES.map((filename) => {
    const raw = fs.readFileSync(path.join(dir, filename), "utf8");
    return rewriteAiLinks(demoteHeadings(raw.trim()));
  });
  const intro = [
    "# AI authoring",
    "",
    "> Status: source-of-truth",
    "> Goal: emit and patch MotionProjectV1. Twelve sections, one page.",
    "",
  ].join("\n");
  return `${intro}\n${sections.join("\n\n---\n\n")}\n`;
}

export function getAiAuthoringPage(): DocsPageView {
  const markdown = loadCombinedMarkdown();
  return withOnThisPage({
    title: "AI authoring",
    toc: tocFromMarkdown(markdown),
    body: createElement(DocsMarkdown, { markdown }),
  });
}
