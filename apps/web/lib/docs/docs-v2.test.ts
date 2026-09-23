import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/docs/DocsMarkdown", () => ({
  DocsMarkdown: () => null,
}));
import {
  DOCS_ENTRIES,
  DOCS_NAV,
  DOCS_PAGE_SLUGS,
  getDocsPage,
  getV2DocsPage,
  isHiddenDocsSlug,
} from "./docs";

const publicContentPath = path.join(process.cwd(), "lib", "docs", "docs.tsx");
const contentRoot = path.join(process.cwd(), "lib", "docs", "content");

function collectMarkdownFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => path.join(dir, name));
}

describe("static V2 documentation", () => {
  it("resolves every published page without a preview project", () => {
    for (const slug of DOCS_PAGE_SLUGS) {
      const page = getDocsPage(slug);
      expect(page.title).toBeTruthy();
      expect(page.body).toBeTruthy();
      expect(page.previewProject).toBeUndefined();
    }
  });

  it("keeps unfinished high-level components hidden but registered", () => {
    const components = DOCS_ENTRIES.filter((entry) => entry.group === "hidden");
    expect(components.length).toBeGreaterThan(0);
    expect(components.every((entry) => entry.status === "hidden")).toBe(true);
    expect(isHiddenDocsSlug("components")).toBe(true);
    expect(DOCS_PAGE_SLUGS).not.toContain("components");
    expect(DOCS_NAV.flatMap((group) => group.items.map((item) => item.href))).not.toContain(
      "/docs/components",
    );
  });

  it("keeps internal architecture out of the public docs", () => {
    expect(DOCS_PAGE_SLUGS).not.toContain("architecture");
    expect(DOCS_NAV.flatMap((group) => group.items.map((item) => item.href))).not.toContain(
      "/docs/architecture",
    );
    expect(getV2DocsPage("architecture")).toBeNull();
  });

  it("keeps the public content static and V2-only", () => {
    const forbidden = [
      /@motionvideo\/(motion-compiler|motion-runtime)/,
      /MotionProjectV1|parseMotionProjectV1|transform\.depth|transform\.origin/,
      /\bbone\b/,
    ];
    const sources = [publicContentPath, ...collectMarkdownFiles(contentRoot)];
    for (const filePath of sources) {
      const source = readFileSync(filePath, "utf8");
      for (const pattern of forbidden) {
        expect(source, `${filePath} matched ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
