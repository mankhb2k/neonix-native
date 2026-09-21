import { expect, test, type Page } from "@playwright/test";

const cases = [
  "html-compiler.text.paint.gradient-linear",
  "html-compiler.text.paint.gradient-radial",
  "html-compiler.text.paint.gradient-conic",
] as const;

type PixelDiff = {
  width: number;
  height: number;
  changedRatio: number;
  meanAbsoluteDelta: number;
};

function comparePixels(page: Page, browserPng: Buffer, skiaPng: Buffer): Promise<PixelDiff> {
  return page.evaluate<PixelDiff, { browserBytes: number[]; skiaBytes: number[] }>(async ({ browserBytes, skiaBytes }) => {
    const decode = async (bytes: number[]): Promise<ImageData> => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Pixel diff readback context is unavailable");
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      return context.getImageData(0, 0, canvas.width, canvas.height);
    };
    const browser = await decode(browserBytes);
    const skia = await decode(skiaBytes);
    const width = Math.min(browser.width, skia.width);
    const height = Math.min(browser.height, skia.height);
    let changedPixels = 0;
    let totalDelta = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const browserIndex = (y * browser.width + x) * 4;
        const skiaIndex = (y * skia.width + x) * 4;
        const delta = Math.max(
          Math.abs(browser.data[browserIndex]! - skia.data[skiaIndex]!),
          Math.abs(browser.data[browserIndex + 1]! - skia.data[skiaIndex + 1]!),
          Math.abs(browser.data[browserIndex + 2]! - skia.data[skiaIndex + 2]!),
        );
        totalDelta += delta;
        if (delta > 8) changedPixels += 1;
      }
    }
    return {
      width,
      height,
      changedRatio: changedPixels / (width * height),
      meanAbsoluteDelta: totalDelta / (width * height),
    };
  }, { browserBytes: [...browserPng], skiaBytes: [...skiaPng] });
}

for (const id of cases) {
  test(`keeps ${id} within Browser CSS / CanvasKit raster tolerance`, async ({ page }, testInfo) => {
    await page.goto(`/docs/preview/html-compiler?case=${id}`, { waitUntil: "domcontentloaded" });
    const canvas = page.getByTestId("html-compiler-runtime-canvas");
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /unsupported|fallback/);
    const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
    await frame?.evaluate(() => document.fonts.ready);
    const browserPng = await page.locator('[data-testid="html-compiler-browser-stage"] iframe').screenshot();
    const skiaPng = await canvas.screenshot();
    const diff = await comparePixels(page, browserPng, skiaPng);
    await testInfo.attach("browser-canvas-kit-pixel-diff.json", {
      body: JSON.stringify(diff, null, 2),
      contentType: "application/json",
    });
    expect(diff.changedRatio, `${id} changed ratio`).toBeLessThan(0.03);
    expect(diff.meanAbsoluteDelta, `${id} mean absolute delta`).toBeLessThan(1.8);
  });
}
