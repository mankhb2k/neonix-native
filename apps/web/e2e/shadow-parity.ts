import { expect, type Page } from "@playwright/test";

export type ShadowMetrics = {
  width: number;
  height: number;
  haloPixels: number;
  peakChroma: number;
  meanChroma: number;
  bounds: { left: number; top: number; right: number; bottom: number } | null;
};

export type ShadowMeasurement = {
  browser: ShadowMetrics;
  skia: ShadowMetrics;
  changedPixels: number;
  changedRatio: number;
  meanAbsoluteDelta: number;
  maxChannelDelta: number;
};

export async function openShadowCase(page: Page, id: string): Promise<void> {
  await page.goto(`/docs/preview/html-compiler?case=${id}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("html-compiler-runtime-canvas")).toHaveAttribute(
    "data-preview-state",
    "ready",
    { timeout: 30_000 },
  );
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  await frame?.evaluate(() => document.fonts.ready);
  await expect(page.getByTestId("html-compiler-browser-stage")).toBeVisible();
  await expect(page.getByTestId("html-compiler-runtime-stage")).toBeVisible();
}

export async function measureShadowScreenshots(page: Page): Promise<ShadowMeasurement> {
  const browserPng = await page
    .locator('[data-testid="html-compiler-browser-stage"] iframe')
    .screenshot();
  const skiaPng = await page.getByTestId("html-compiler-runtime-canvas").screenshot();
  return page.evaluate(async ({ browserPng, skiaPng }) => {
    const decode = async (bytes: number[], width?: number, height?: number): Promise<ImageData> => {
      const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = width ?? bitmap.width;
      canvas.height = height ?? bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Screenshot readback context is unavailable");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      return context.getImageData(0, 0, canvas.width, canvas.height);
    };
    const browserImage = await decode(browserPng);
    const skiaImage = await decode(skiaPng);
    const width = Math.min(browserImage.width, skiaImage.width);
    const height = Math.min(browserImage.height, skiaImage.height);
    const browser = await decode(browserPng, width, height);
    const skia = await decode(skiaPng, width, height);

    const measure = (image: ImageData): ShadowMetrics => {
      let haloPixels = 0;
      let peakChroma = 0;
      let totalChroma = 0;
      let left = image.width;
      let top = image.height;
      let right = -1;
      let bottom = -1;
      for (let index = 0; index < image.data.length; index += 4) {
        const red = image.data[index]!;
        const green = image.data[index + 1]!;
        const blue = image.data[index + 2]!;
        const chroma = Math.max(0, blue - red);
        const isHalo = chroma > 18 && green - red > 25 && blue > 38 && red < 190;
        if (!isHalo) continue;
        haloPixels += 1;
        peakChroma = Math.max(peakChroma, chroma);
        totalChroma += chroma;
        const pixel = index / 4;
        const x = pixel % image.width;
        const y = Math.floor(pixel / image.width);
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
      return {
        width: image.width,
        height: image.height,
        haloPixels,
        peakChroma,
        meanChroma: haloPixels ? totalChroma / haloPixels : 0,
        bounds: right < 0 ? null : { left, top, right, bottom },
      };
    };

    let changedPixels = 0;
    let totalDelta = 0;
    let maxChannelDelta = 0;
    for (let index = 0; index < browser.data.length; index += 4) {
      const delta = Math.max(
        Math.abs(browser.data[index]! - skia.data[index]!),
        Math.abs(browser.data[index + 1]! - skia.data[index + 1]!),
        Math.abs(browser.data[index + 2]! - skia.data[index + 2]!),
        Math.abs(browser.data[index + 3]! - skia.data[index + 3]!),
      );
      totalDelta += delta;
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      if (delta > 8) changedPixels += 1;
    }
    const pixelCount = browser.data.length / 4;
    return {
      browser: measure(browser),
      skia: measure(skia),
      changedPixels,
      changedRatio: changedPixels / pixelCount,
      meanAbsoluteDelta: totalDelta / pixelCount,
      maxChannelDelta,
    };
  }, { browserPng: [...browserPng], skiaPng: [...skiaPng] });
}
