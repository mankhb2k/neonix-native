import { expect, test, type Page } from "@playwright/test";

const cases = [
  "html-compiler.tags.document-shell-container",
  "html-compiler.tags.text-lowering",
  "html-compiler.tags.media-lowering",
  "html-compiler.tags.audio-lowering",
  "html-compiler.tags.svg-lowering",
  "html-compiler.tags.container-aliases",
  "html-compiler.tags.text-tag-matrix",
  "html-compiler.tags.svg-primitive-matrix",
] as const;

type Protocol = {
  layers?: Array<{ id?: string; type?: string; parentLayerId?: string | null }>;
  assets?: Array<{ id?: string; kind?: string }>;
  audio?: { tracks?: Array<{ id?: string; clips?: Array<{ assetId?: string }> }> };
};

async function readProtocol(page: Page): Promise<Protocol> {
  const source = await page.locator("pre").last().textContent();
  return JSON.parse(source ?? "{}") as Protocol;
}

async function assertFinalDocument(page: Page): Promise<void> {
  const html = await page.getByTestId("html-compiler-source-canvas").locator("pre").textContent();
  expect(html?.match(/<meta[^>]+name=["']neonix-document["']/gi)).toHaveLength(1);
  expect(html).toContain('"schemaVersion":2');
  expect(html).toMatch(/<style\b/i);
}

async function assertBrowserPreview(page: Page): Promise<void> {
  const iframe = page.locator('iframe[title^="Native browser HTML CSS reference"]');
  await expect.poll(async () => iframe.evaluate((node) => {
    const document = (node as HTMLIFrameElement).contentDocument;
    return Boolean(document?.body?.innerHTML.trim());
  })).toBe(true);
}

test.describe("HTML compiler tag lowering fixtures", () => {
  for (const id of cases) {
    test(id, async ({ page }) => {
      await page.goto(`/docs/preview/html-compiler?case=${id}`, { waitUntil: "domcontentloaded" });
      const canvas = page.getByTestId("html-compiler-runtime-canvas");
      await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /unsupported|fallback/);
      await assertFinalDocument(page);
      await assertBrowserPreview(page);

      const protocol = await readProtocol(page);
      const layers = protocol.layers ?? [];
      const assets = protocol.assets ?? [];

      if (id.endsWith("document-shell-container")) {
        expect(layers).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: "scene", type: "group" }),
          expect.objectContaining({ id: "card", type: "group", parentLayerId: "scene" }),
          expect.objectContaining({ id: "fill", type: "shape", parentLayerId: "card" }),
        ]));
      } else if (id.endsWith("text-lowering")) {
        expect(layers).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: "title", type: "text" }),
          expect.objectContaining({ id: "caption", type: "text" }),
        ]));
      } else if (id.endsWith("media-lowering")) {
        expect(layers).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: "poster", type: "image" }),
          expect.objectContaining({ id: "clip", type: "video" }),
        ]));
        expect(assets).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: "poster-asset", kind: "image" }),
          expect.objectContaining({ id: "clip-asset", kind: "video" }),
        ]));
      } else if (id.endsWith("audio-lowering")) {
        expect(layers.some((layer) => layer.id === "music")).toBe(false);
        expect(assets).toEqual(expect.arrayContaining([expect.objectContaining({ id: "music-asset", kind: "audio" })]));
        expect(protocol.audio?.tracks).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: "music", clips: [expect.objectContaining({ assetId: "music-asset" })] }),
        ]));
      } else if (id.endsWith("svg-lowering")) {
        expect(layers).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: "logo", type: "group" }),
          expect.objectContaining({ id: "panel", type: "path" }),
          expect.objectContaining({ id: "dot", type: "path" }),
          expect.objectContaining({ id: "rule", type: "path" }),
          expect.objectContaining({ id: "arrow", type: "path" }),
        ]));
      } else if (id.endsWith("container-aliases")) {
        expect(layers).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: "main", type: "group" }),
          expect.objectContaining({ id: "header", type: "group" }),
          expect.objectContaining({ id: "nav", type: "group" }),
          expect.objectContaining({ id: "aside", type: "group" }),
          expect.objectContaining({ id: "figure", type: "group" }),
          expect.objectContaining({ id: "footer", type: "group" }),
          expect.objectContaining({ id: "figcaption", type: "text" }),
        ]));
      } else if (id.endsWith("text-tag-matrix")) {
        const textIds = ["h2", "h3", "h4", "h5", "h6", "span", "bold", "emphasis", "italic", "small", "quote", "pre", "code"];
        expect(layers.filter((layer) => layer.type === "text").map((layer) => layer.id)).toEqual(textIds);
      } else {
        expect(layers).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: "matrix", type: "group" }),
          expect.objectContaining({ id: "nested-group", type: "group" }),
          expect.objectContaining({ id: "path", type: "path" }),
          expect.objectContaining({ id: "ellipse", type: "path" }),
          expect.objectContaining({ id: "polyline", type: "path" }),
        ]));
      }
    });
  }
});
