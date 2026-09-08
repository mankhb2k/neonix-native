import { expect, test, type Page } from "@playwright/test";

const cases = [
  "text-frame-baseline",
  "text-border-uniform",
  "text-border-asymmetric",
  "text-border-padding",
  "text-content-box",
  "text-border-box",
  "text-line-height-normal",
  "text-line-height-fixed",
  "text-wrapping-border",
  "text-border-radius",
] as const;

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };

async function browserBox(page: Page, selector: string): Promise<Box | null> {
  const iframe = page.locator('[data-testid="html-compiler-browser-stage"] iframe');
  const iframeBox = await iframe.boundingBox();
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  const elementBox = frame ? await frame.locator(selector).boundingBox() : null;
  if (!iframeBox || !elementBox) return null;
  return {
    left: (elementBox.x - iframeBox.x) * 1920 / iframeBox.width,
    top: (elementBox.y - iframeBox.y) * 1080 / iframeBox.height,
    right: (elementBox.x + elementBox.width - iframeBox.x) * 1920 / iframeBox.width,
    bottom: (elementBox.y + elementBox.height - iframeBox.y) * 1080 / iframeBox.height,
    width: elementBox.width * 1920 / iframeBox.width,
    height: elementBox.height * 1080 / iframeBox.height,
  };
}

async function canvasPaintedPixels(page: Page): Promise<number> {
  return page.getByTestId("html-compiler-runtime-canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Runtime canvas readback is unavailable");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] !== 8 || pixels[index + 1] !== 16 || pixels[index + 2] !== 24) painted += 1;
    }
    return painted;
  });
}

test.describe("HTML compiler text border-box frame parity", () => {
  for (const id of cases) {
    test(id, async ({ page }) => {
      await page.goto(`/docs/preview/html-compiler?case=html-compiler.layout.${id}`, { waitUntil: "domcontentloaded" });
      const canvas = page.getByTestId("html-compiler-runtime-canvas");
      await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });

      const browser = await browserBox(page, `#${id}`);
      const protocolText = await page.locator("pre").last().textContent();
      const protocol = JSON.parse(protocolText ?? "{}") as {
        layers?: Array<{ id?: string; type?: string; frame?: { width: number; height: number }; transform?: { translate?: { x?: number; y?: number } } }>;
      };
      const layer = protocol.layers?.find((candidate) => candidate.id === id && candidate.type === "group")
        ?? protocol.layers?.find((candidate) => candidate.id === `${id}::text` && candidate.type === "text");
      const textLayer = protocol.layers?.find((candidate) => candidate.id === id && candidate.type === "text")
        ?? protocol.layers?.find((candidate) => candidate.id === `${id}::text` && candidate.type === "text");

      expect(browser, "Browser border-box").not.toBeNull();
      expect(textLayer?.type).toBe("text");
      expect(layer?.frame).toBeDefined();
      expect(layer?.transform?.translate).toBeDefined();
      expect(await canvas.getAttribute("data-diagnostics")).not.toMatch(/unsupported|fallback/);
      expect(await canvasPaintedPixels(page)).toBeGreaterThan(1_000);
      if (!browser || !layer?.frame || !layer.transform?.translate) return;

      // CSS and Protocol both describe the element's border box. A small
      // tolerance covers iframe display scaling and subpixel layout rounding;
      // this is intentionally much tighter than a raster/glyph comparison.
      expect(Math.abs(browser.left - (layer.transform.translate.x ?? 0))).toBeLessThanOrEqual(2);
      expect(Math.abs(browser.top - (layer.transform.translate.y ?? 0))).toBeLessThanOrEqual(2);
      expect(Math.abs(browser.width - layer.frame.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(browser.height - layer.frame.height)).toBeLessThanOrEqual(2);
    });
  }
});
