import { expect, test, type Page } from "@playwright/test";

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };

const fixtures = [
  { id: "atomic-transform-style-flat", selector: "#atomic-flat-card", color: [56, 189, 248], semantic: '"transformStyle": "flat"', painted: true },
  { id: "atomic-transform-style-preserve-3d", selector: "#atomic-preserve-card", color: [56, 189, 248], semantic: '"transformStyle": "preserve-3d"', painted: true },
  { id: "atomic-backface-visible", selector: "#atomic-backface-visible-card", color: [249, 115, 22], semantic: null, painted: true },
  { id: "atomic-backface-hidden", selector: "#atomic-backface-hidden-card", color: [249, 115, 22], semantic: '"backfaceVisibility": "hidden"', painted: false },
] as const;

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

async function canvasColorBounds(page: Page, color: readonly number[]) {
  return page.getByTestId("html-compiler-runtime-canvas").evaluate((element, target) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Runtime canvas readback is unavailable");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width;
    let top = canvas.height;
    let right = -1;
    let bottom = -1;
    let painted = 0;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        if (pixels[offset] !== 8 || pixels[offset + 1] !== 16 || pixels[offset + 2] !== 24) painted += 1;
        if (Math.abs(pixels[offset]! - target[0]!) <= 10 && Math.abs(pixels[offset + 1]! - target[1]!) <= 10 && Math.abs(pixels[offset + 2]! - target[2]!) <= 10 && pixels[offset + 3]! > 0) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
    }
    return {
      bounds: right < 0 ? null : { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 },
      painted,
      diagnostics: canvas.getAttribute("data-diagnostics"),
    };
  }, color);
}

test.describe("HTML compiler atomic 3D semantics", () => {
  for (const fixture of fixtures) {
    test(fixture.id, async ({ page }) => {
      await page.goto(`/docs/preview/html-compiler?case=html-compiler.perspective.${fixture.id}`, { waitUntil: "domcontentloaded" });
      const canvas = page.getByTestId("html-compiler-runtime-canvas");
      await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
      const protocol = await page.locator("pre").last().textContent();
      const actual = await canvasColorBounds(page, fixture.color);
      const expected = await browserBox(page, fixture.selector);

      if (fixture.semantic) expect(protocol).toContain(fixture.semantic);
      else expect(protocol).not.toContain('"backfaceVisibility"');
      expect(protocol).toContain('"render3d"');
      expect(actual.diagnostics).not.toMatch(/unsupported|fallback/);
      if (fixture.painted) {
        expect(actual.painted).toBeGreaterThan(1_000);
        expect(actual.bounds).not.toBeNull();
        expect(expected).not.toBeNull();
        expect(Math.abs(actual.bounds!.left - expected!.left)).toBeLessThanOrEqual(24);
        expect(Math.abs(actual.bounds!.top - expected!.top)).toBeLessThanOrEqual(24);
        expect(Math.abs(actual.bounds!.right - expected!.right)).toBeLessThanOrEqual(24);
        expect(Math.abs(actual.bounds!.bottom - expected!.bottom)).toBeLessThanOrEqual(24);
      } else {
        expect(actual.painted).toBe(0);
        expect(actual.bounds).toBeNull();
      }
    });
  }
});
