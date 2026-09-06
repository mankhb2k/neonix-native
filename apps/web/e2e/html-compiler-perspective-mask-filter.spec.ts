import { expect, test } from "@playwright/test";

const cases = [
  "mask-alpha-near-plane",
  "mask-luminance-near-plane",
  "mask-add-intersect-near-plane",
  "mask-subtract-composition-edge",
  "mask-exclude-inclined",
  "filter-blur-near-plane",
  "filter-drop-shadow-after-blur-near-plane",
  "filter-mask-clip-path",
  "isolated-mask-filter-projective",
  "mask-different-perspective-boundary",
  "filter-far-plane-bounds",
  "mask-one-corner-near-plane",
] as const;

test.describe("HTML compiler Phase 9 projective mask/filter", () => {
  for (const id of cases) {
    test(`${id} preserves the mask/filter projective pipeline`, async ({ page }) => {
      await page.goto(`/docs/preview/html-compiler?case=html-compiler.perspective.${id}`, { waitUntil: "domcontentloaded" });
      const canvas = page.getByTestId("html-compiler-runtime-canvas");
      const protocol = page.locator("pre").last();
      await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
      await expect(page.getByTestId("html-compiler-browser-stage")).toBeVisible();
      await expect(page.getByTestId("html-compiler-runtime-stage")).toBeVisible();
      await expect.poll(async () => (await protocol.textContent()) ?? "").toMatch(/"type": "(shape|group|path)"/);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_(mask|effect|clip_path)_unsupported|preview_asset_missing/);
      await expect.poll(async () => Number(await canvas.getAttribute("data-draw-calls"))).toBeGreaterThan(0);
    });
  }

  test("captures representative near-plane mask/filter parity", async ({ page }) => {
    await page.goto("/docs/preview/html-compiler?case=html-compiler.perspective.mask-alpha-near-plane", { waitUntil: "domcontentloaded" });
    const canvas = page.getByTestId("html-compiler-runtime-canvas");
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    await page.screenshot({ path: "test-results-motion-path/phase9-mask-alpha-near-plane.png", fullPage: true });
  });

  test("isolated projective mask/filter keeps the projected group and child blend", async ({ page }) => {
    await page.goto("/docs/preview/html-compiler?case=html-compiler.perspective.isolated-mask-filter-projective", { waitUntil: "domcontentloaded" });
    const canvas = page.getByTestId("html-compiler-runtime-canvas");
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    await expect.poll(async () => canvas.evaluate((element: HTMLCanvasElement) => {
      const context = element.getContext("2d");
      if (!context) return 0;
      const pixels = context.getImageData(0, 0, element.width, element.height).data;
      let painted = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] !== 8 || pixels[index + 1] !== 16 || pixels[index + 2] !== 24) painted += 1;
      }
      return painted;
    })).toBeGreaterThan(10_000);
    await page.screenshot({ path: "playwright-p9-isolated-fix/isolated-mask-filter-projective.png", fullPage: true });
  });

  test("captures drop-shadow after blur for pixel inspection", async ({ page }) => {
    await page.goto("/docs/preview/html-compiler?case=html-compiler.perspective.filter-drop-shadow-after-blur-near-plane", { waitUntil: "domcontentloaded" });
    const canvas = page.getByTestId("html-compiler-runtime-canvas");
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    const metrics = await canvas.evaluate((element: HTMLCanvasElement) => {
      const context = element.getContext("2d");
      if (!context) return null;
      const data = context.getImageData(0, 0, element.width, element.height).data;
      let blueish = 0;
      let nonBackground = 0;
      let blueishBounds = { left: element.width, top: element.height, right: -1, bottom: -1 };
      for (let y = 0; y < element.height; y += 1) for (let x = 0; x < element.width; x += 1) {
        const index = (y * element.width + x) * 4;
        const r = data[index]!, g = data[index + 1]!, b = data[index + 2]!;
        if (r !== 8 || g !== 16 || b !== 24) nonBackground += 1;
        if (b > r * 1.35 && b > g * 1.15 && g > 30 && b > 45 && r < 180) {
          blueish += 1;
          blueishBounds.left = Math.min(blueishBounds.left, x);
          blueishBounds.top = Math.min(blueishBounds.top, y);
          blueishBounds.right = Math.max(blueishBounds.right, x);
          blueishBounds.bottom = Math.max(blueishBounds.bottom, y);
        }
      }
      return { diagnostics: element.getAttribute("data-diagnostics"), drawCalls: element.getAttribute("data-draw-calls"), nonBackground, blueish, blueishBounds };
    });
    expect(metrics.blueish).toBeGreaterThan(0);
    await page.screenshot({ path: "playwright-p9-drop-shadow/drop-shadow-after-blur.png", fullPage: true });
  });
});
