import { readFileSync } from "node:fs";
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
    const source = readFileSync(publicContentPath, "utf8");
    expect(source).not.toMatch(/@motionvideo\/(motion-compiler|motion-runtime|preview-renderer)/);
    expect(source).not.toMatch(/MotionProjectV1|parseMotionProjectV1|transform\.depth|transform\.origin/);
    expect(source).not.toMatch(/\bbone\b/);
  });
});
