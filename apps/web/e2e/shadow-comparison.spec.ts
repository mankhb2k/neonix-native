import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const WIDTH = 1920;
const HEIGHT = 1080;
const REPORT_ROOT = resolve(process.cwd(), "..", "..", "tmp", "shadow-comparison");
const CASES = [
  "outer-glow-plain",
  "outer-glow-stack",
  "outer-glow-overlay-only",
  "inner-glow-mask-only",
  "mixed-glow-order-colors",
  "inner-outer-glow-order",
] as const;

async function captureSurface(page: Page, surface: Locator): Promise<Buffer> {
  await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();
  if (!box) throw new Error("Native surface bounds are unavailable");
  return page.screenshot({ type: "png", clip: { x: box.x, y: box.y, width: WIDTH, height: HEIGHT } });
}

async function pixelDiff(page: Page, browserPng: Buffer, skiaPng: Buffer): Promise<Record<string, unknown>> {
  return page.evaluate(async ({ browserUrl, skiaUrl }) => {
    const decode = async (url: string) => {
      const bitmap = await createImageBitmap(await (await fetch(url)).blob());
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      context?.drawImage(bitmap, 0, 0);
      bitmap.close();
      return context?.getImageData(0, 0, canvas.width, canvas.height);
    };
    const [browser, skia] = await Promise.all([decode(browserUrl), decode(skiaUrl)]);
    if (!browser || !skia || browser.width !== skia.width || browser.height !== skia.height) throw new Error("Invalid comparison images");
    let changed = 0;
    let delta = 0;
    const sample = (image: ImageData, x: number, y: number) => {
      const index = (y * image.width + x) * 4;
      return image.data[index] ?? 0;
    };
    const topProfile = (image: ImageData) => Array.from({ length: 81 }, (_, offset) => sample(image, 960, 280 + offset));
    const leftProfile = (image: ImageData) => Array.from({ length: 81 }, (_, offset) => sample(image, 580 + offset, 500));
    for (let index = 0; index < browser.data.length; index += 4) {
      const value = Math.max(
        Math.abs(browser.data[index]! - skia.data[index]!),
        Math.abs(browser.data[index + 1]! - skia.data[index + 1]!),
        Math.abs(browser.data[index + 2]! - skia.data[index + 2]!),
        Math.abs(browser.data[index + 3]! - skia.data[index + 3]!),
      );
      if (value > 8) changed += 1;
      delta += value;
    }
    return {
      changedRatio: changed / (browser.width * browser.height),
      meanAbsoluteDelta: delta / (browser.width * browser.height * 4),
      topProfileBrowser: topProfile(browser),
      topProfileSkia: topProfile(skia),
      leftProfileBrowser: leftProfile(browser),
      leftProfileSkia: leftProfile(skia),
    };
  }, {
    browserUrl: `data:image/png;base64,${browserPng.toString("base64")}`,
    skiaUrl: `data:image/png;base64,${skiaPng.toString("base64")}`,
  });
}

test("captures the core ordered-shadow diagnostics at native resolution", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(REPORT_ROOT, { recursive: true });
  await page.setViewportSize({ width: 2200, height: 3000 });
  await page.goto("/playground/native-stage", { waitUntil: "domcontentloaded" });

  const picker = page.getByTestId("radial-native-case-picker");
  const browser = page.getByTestId("radial-native-browser-iframe");
  const skia = page.getByTestId("radial-native-skia-canvas");
  await expect(picker).toBeEnabled({ timeout: 30_000 });

  const report: Record<string, unknown> = {};
  for (const fixture of CASES) {
    await picker.selectOption(fixture);
    await expect(picker).toHaveValue(fixture);
    await expect(skia).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    console.log(`${fixture} diagnostics=${await skia.getAttribute("data-diagnostics") ?? "none"}`);
    const browserPng = await captureSurface(page, browser);
    const skiaPng = await captureSurface(page, skia);
    writeFileSync(resolve(REPORT_ROOT, `${fixture}.browser.png`), browserPng);
    writeFileSync(resolve(REPORT_ROOT, `${fixture}.skia.png`), skiaPng);
    report[fixture] = await pixelDiff(page, browserPng, skiaPng);
  }
  writeFileSync(resolve(REPORT_ROOT, "report.json"), JSON.stringify({ width: WIDTH, height: HEIGHT, report }, null, 2));
});
