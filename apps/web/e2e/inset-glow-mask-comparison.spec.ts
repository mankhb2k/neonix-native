import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const WIDTH = 1920;
const HEIGHT = 1080;
const REPORT_ROOT = resolve(process.cwd(), "..", "..", "tmp", "inset-glow-mask-comparison");

const CASES = [
  "phase8-inset-rounded-small",
  "phase8-inset-rounded-medium",
  "phase8-inset-rounded-large",
  "phase8-inset-transparent-rounded-small",
  "phase8-inset-transparent-rounded-medium",
  "phase8-inset-transparent-rounded-large",
] as const;

type Region = { name: string; x: number; y: number; width: number; height: number };

const REGIONS: readonly Region[] = [
  { name: "core", x: 680, y: 380, width: 560, height: 240 },
  { name: "edge", x: 620, y: 320, width: 120, height: 120 },
  { name: "corner", x: 620, y: 320, width: 80, height: 80 },
];

type Diff = {
  width: number;
  height: number;
  changedPixels: number;
  changedRatio: number;
  meanAbsoluteDelta: number;
  regions: Array<Region & { changedRatio: number; meanAbsoluteDelta: number }>;
};

function dataUrl(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function comparePixels(
  page: Page,
  left: Buffer,
  right: Buffer,
  threshold: number,
): Promise<Diff> {
  return page.evaluate(async ({ leftUrl, rightUrl, threshold: pixelThreshold, regions }) => {
    const decode = async (url: string) => {
      const response = await fetch(url);
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
      bitmap.close();
      return canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height);
    };
    const [leftImage, rightImage] = await Promise.all([decode(leftUrl), decode(rightUrl)]);
    if (!leftImage || !rightImage) throw new Error("Pixel comparison canvas is unavailable");
    if (leftImage.width !== rightImage.width || leftImage.height !== rightImage.height) {
      throw new Error("Pixel comparison surfaces must have identical dimensions");
    }

    const compareRegion = (x: number, y: number, width: number, height: number) => {
      const x0 = Math.max(0, Math.floor(x));
      const y0 = Math.max(0, Math.floor(y));
      const x1 = Math.min(leftImage.width, Math.ceil(x + width));
      const y1 = Math.min(leftImage.height, Math.ceil(y + height));
      let changedPixels = 0;
      let totalDelta = 0;
      let totalPixels = 0;
      for (let py = y0; py < y1; py += 1) {
        for (let px = x0; px < x1; px += 1) {
          const index = (py * leftImage.width + px) * 4;
          const delta = Math.max(
            Math.abs(leftImage.data[index]! - rightImage.data[index]!),
            Math.abs(leftImage.data[index + 1]! - rightImage.data[index + 1]!),
            Math.abs(leftImage.data[index + 2]! - rightImage.data[index + 2]!),
            Math.abs(leftImage.data[index + 3]! - rightImage.data[index + 3]!),
          );
          if (delta > pixelThreshold) changedPixels += 1;
          totalDelta += delta;
          totalPixels += 1;
        }
      }
      return {
        changedPixels,
        changedRatio: totalPixels ? changedPixels / totalPixels : 0,
        meanAbsoluteDelta: totalPixels ? totalDelta / totalPixels : 0,
      };
    };

    const full = compareRegion(0, 0, leftImage.width, leftImage.height);
    return {
      width: leftImage.width,
      height: leftImage.height,
      ...full,
      regions: regions.map((region) => ({ ...region, ...compareRegion(region.x, region.y, region.width, region.height) })),
    };
  }, { leftUrl: dataUrl(left), rightUrl: dataUrl(right), threshold, regions: REGIONS });
}

async function captureNativeSurface(page: Page, surface: Locator): Promise<Buffer> {
  await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();
  if (!box) throw new Error("Native surface bounds are unavailable");
  return page.screenshot({ type: "png", clip: { x: box.x, y: box.y, width: WIDTH, height: HEIGHT } });
}

test("compares the six focused inset-glow mask fixtures at native resolution", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(REPORT_ROOT, { recursive: true });
  await page.setViewportSize({ width: 2200, height: 3000 });
  await page.goto("/debug/native-stage", { waitUntil: "domcontentloaded" });

  const picker = page.getByTestId("radial-native-case-picker");
  const browser = page.getByTestId("radial-native-browser-iframe");
  const skia = page.getByTestId("radial-native-skia-canvas");
  await expect(picker).toBeEnabled({ timeout: 30_000 });

  const report: Array<{ fixture: string; browserVsSkia: Diff }> = [];
  for (const fixture of CASES) {
    await picker.selectOption(fixture);
    await expect(picker).toHaveValue(fixture);
    await expect(skia).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    await expect(skia).toHaveAttribute("data-backend", "skia");

    const browserPng = await captureNativeSurface(page, browser);
    const skiaPng = await captureNativeSurface(page, skia);
    const diff = await comparePixels(page, browserPng, skiaPng, 8);
    expect(diff).toMatchObject({ width: WIDTH, height: HEIGHT });
    expect(diff.changedRatio, `${fixture} catastrophic pixel divergence`).toBeLessThan(0.98);
    writeFileSync(resolve(REPORT_ROOT, `${fixture}.browser.png`), browserPng);
    writeFileSync(resolve(REPORT_ROOT, `${fixture}.skia.png`), skiaPng);
    report.push({ fixture, browserVsSkia: diff });
  }

  writeFileSync(resolve(REPORT_ROOT, "report.json"), JSON.stringify({ width: WIDTH, height: HEIGHT, report }, null, 2));
  expect(report).toHaveLength(CASES.length);
});
