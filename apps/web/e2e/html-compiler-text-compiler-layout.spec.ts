import { expect, test, type Page } from "@playwright/test";

const cases = [
  "html-compiler.text.compiler.br-hard-break",
  "html-compiler.text.compiler.nested-inline-content",
  "html-compiler.text.compiler.whitespace-contract",
  "html-compiler.text.layout.fixed-line-height",
  "html-compiler.text.layout.wrap-width",
  "html-compiler.text.layout.auto-height",
] as const;

type TextLayer = {
  id?: string;
  type?: string;
  frame?: { width?: number; height?: number };
  payload?: {
    source?: { text?: string };
    layout?: {
      sizing?: string;
      lineHeight?: number;
      contentWidth?: number;
      whiteSpace?: string;
      wrap?: string;
      hardBreaks?: number[];
    };
  };
};

type Protocol = { layers?: TextLayer[] };

async function readTextLayer(page: Page, id: string): Promise<TextLayer> {
  const source = await page.locator("pre").last().textContent();
  const protocol = JSON.parse(source ?? "{}") as Protocol;
  const layer = protocol.layers?.find((candidate) => candidate.id === id && candidate.type === "text");
  expect(layer, `missing text layer ${id}`).toBeDefined();
  return layer!;
}

test.describe("HTML compiler text compiler/layout fixtures", () => {
  for (const id of cases) {
    test(id, async ({ page }) => {
      await page.goto(`/docs/preview/html-compiler?case=${id}`, { waitUntil: "domcontentloaded" });
      const canvas = page.getByTestId("html-compiler-runtime-canvas");
      await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /unsupported|fallback/);
    });
  }

  test("keeps compiler semantics and layout geometry inspectable", async ({ page }) => {
    await page.goto("/docs/preview/html-compiler?case=html-compiler.text.compiler.br-hard-break", { waitUntil: "domcontentloaded" });
    const canvas = page.getByTestId("html-compiler-runtime-canvas");
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });

    const hardBreak = await readTextLayer(page, "hard-break");
    expect(hardBreak.payload?.source?.text).toBe("Video title\nline two");
    expect(hardBreak.payload?.layout).toMatchObject({ whiteSpace: "normal", wrap: "word", lineHeight: 86.4, hardBreaks: [11] });
    expect(hardBreak.frame).toEqual({ width: 900, height: 180 });

    await page.goto("/docs/preview/html-compiler?case=html-compiler.text.compiler.whitespace-contract", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("html-compiler-runtime-canvas")).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    const source = await page.locator("pre").last().textContent();
    const protocol = JSON.parse(source ?? "{}") as Protocol;
    const normal = protocol.layers?.find((layer) => layer.id === "normal-space");
    const pre = protocol.layers?.find((layer) => layer.id === "pre-space");
    expect(normal?.payload?.layout).toMatchObject({ whiteSpace: "normal", wrap: "word" });
    expect(pre?.payload?.layout).toMatchObject({ whiteSpace: "pre", wrap: "none" });
    expect(normal?.payload?.source?.text).toBe("A   B\nC");
    expect(pre?.payload?.source?.text).toBe("A   B\nC");
  });
});
