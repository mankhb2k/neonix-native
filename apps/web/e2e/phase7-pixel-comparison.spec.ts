import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const WIDTH = 1920;
const HEIGHT = 1080;
const REPORT_ROOT = resolve(process.cwd(), "..", "..", "tmp", "phase7-pixel-comparison");
const FIXTURES = [
  "phase6-alpha-overlap",
  "phase6-foreground-effects",
  "phase6-filter-chain",
  "phase6-backdrop-isolation",
  "phase6-nested-groups",
  "phase7-root-background-gradient",
  "phase7-element-background-gradient",
  "phase7-foreground-solid-background",
  "phase7-nested-solid-background",
  "phase8-blur-isolation",
  "phase8-shadow-isolation",
  "phase8-inner-glow",
  "phase8-outer-glow",
] as const;
const SAMPLE_FRAMES = [0, 0.5] as const;

type Region = { name: string; x: number; y: number; width: number; height: number };

const REGIONS: Record<(typeof FIXTURES)[number], readonly Region[]> = {
  "phase6-alpha-overlap": [
    { name: "flat-grid", x: 140, y: 120, width: 120, height: 90 },
    { name: "shape-overlap", x: 800, y: 430, width: 180, height: 120 },
    { name: "rounded-edge", x: 340, y: 360, width: 90, height: 90 },
    { name: "text", x: 180, y: 160, width: 900, height: 120 },
  ],
  "phase6-foreground-effects": [
    { name: "shadow-card", x: 240, y: 350, width: 160, height: 140 },
    { name: "blur-card", x: 540, y: 400, width: 160, height: 140 },
    { name: "bright-card", x: 900, y: 320, width: 160, height: 140 },
    { name: "opacity-card", x: 1220, y: 440, width: 160, height: 140 },
  ],
  "phase6-filter-chain": [
    { name: "blur-color-chain", x: 200, y: 350, width: 160, height: 180 },
    { name: "grayscale-opacity-chain", x: 600, y: 350, width: 160, height: 180 },
    { name: "blur-shadow-chain", x: 1000, y: 350, width: 160, height: 180 },
    { name: "shadow-boundary", x: 1180, y: 700, width: 180, height: 100 },
  ],
  "phase6-backdrop-isolation": [
    { name: "mid-ground-corner", x: 220, y: 200, width: 80, height: 80 },
    { name: "glass-rounded-edge", x: 720, y: 440, width: 48, height: 48 },
    { name: "glass-overlap", x: 820, y: 500, width: 160, height: 100 },
    { name: "foreground-filter", x: 1160, y: 460, width: 180, height: 120 },
  ],
  "phase6-nested-groups": [
    { name: "inner-group-edge", x: 300, y: 300, width: 80, height: 80 },
    { name: "nested-overlap", x: 620, y: 480, width: 180, height: 120 },
    { name: "outside-blend", x: 1240, y: 400, width: 180, height: 180 },
    { name: "clip-panel", x: 1320, y: 190, width: 160, height: 120 },
  ],
  "phase7-root-background-gradient": [
    { name: "root-gradient-top", x: 80, y: 80, width: 240, height: 160 },
    { name: "root-gradient-bottom", x: 1400, y: 860, width: 240, height: 140 },
    { name: "control-shape", x: 420, y: 380, width: 180, height: 120 },
  ],
  "phase7-element-background-gradient": [
    { name: "surface-corner", x: 220, y: 200, width: 80, height: 80 },
    { name: "surface-gradient", x: 500, y: 360, width: 220, height: 140 },
    { name: "marker-overlap", x: 820, y: 500, width: 180, height: 100 },
  ],
  "phase7-foreground-solid-background": [
    { name: "shadow-card", x: 240, y: 350, width: 160, height: 140 },
    { name: "blur-card", x: 540, y: 400, width: 160, height: 140 },
    { name: "bright-card", x: 900, y: 320, width: 160, height: 140 },
    { name: "opacity-card", x: 1220, y: 440, width: 160, height: 140 },
  ],
  "phase7-nested-solid-background": [
    { name: "inner-group-edge", x: 300, y: 300, width: 80, height: 80 },
    { name: "nested-overlap", x: 620, y: 480, width: 180, height: 120 },
    { name: "outside-blend", x: 1240, y: 400, width: 180, height: 180 },
    { name: "clip-panel", x: 1320, y: 190, width: 160, height: 120 },
  ],
  "phase8-blur-isolation": [
    { name: "blur-core", x: 760, y: 400, width: 400, height: 200 },
    { name: "blur-edge", x: 600, y: 300, width: 120, height: 120 },
    { name: "blur-expansion", x: 1240, y: 600, width: 160, height: 140 },
  ],
  "phase8-shadow-isolation": [
    { name: "shadow-card", x: 760, y: 400, width: 400, height: 200 },
    { name: "shadow-offset", x: 1240, y: 600, width: 180, height: 160 },
    { name: "shadow-edge", x: 580, y: 300, width: 140, height: 140 },
  ],
  "phase8-inner-glow": [
    { name: "inner-core", x: 760, y: 400, width: 400, height: 200 },
    { name: "inner-edge", x: 620, y: 320, width: 160, height: 140 },
    { name: "inner-corner", x: 620, y: 320, width: 100, height: 100 },
  ],
  "phase8-outer-glow": [
    { name: "outer-core", x: 760, y: 400, width: 400, height: 200 },
    { name: "outer-halo", x: 560, y: 260, width: 180, height: 180 },
    { name: "outer-halo-corner", x: 1240, y: 600, width: 180, height: 180 },
  ],
};

type RegionDiff = Region & {
  changedRatio: number;
  meanAbsoluteDelta: number;
  maxChannelDelta: number;
};

type PixelDiff = {
  width: number;
  height: number;
  changedPixels: number;
  changedRatio: number;
  meanAbsoluteDelta: number;
  maxChannelDelta: number;
  paintedPixels: number;
  regions: RegionDiff[];
};

type SurfaceContract = {
  backend: string | null;
  previewState: string | null;
  width: number;
  height: number;
  runtimeFrame: number;
  runtimeTime: number;
  runtimeCommandCount: number;
  runtimeLayerCount: number;
  drawCalls: number;
  skippedCommands: number;
  diagnostics: string;
};

function dataUrl(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function compareScreenshots(
  page: Page,
  browserPng: Buffer,
  skiaPng: Buffer,
  regions: readonly Region[],
): Promise<PixelDiff> {
  return page.evaluate(async ({ browserUrl, skiaUrl, regions: requestedRegions }) => {
    const decode = async (url: string) => {
      const response = await fetch(url);
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Pixel comparison canvas is unavailable");
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      return { width: canvas.width, height: canvas.height, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data };
    };
    const [browser, skia] = await Promise.all([decode(browserUrl), decode(skiaUrl)]);
    if (browser.width < 1920 || browser.height < 1080 || skia.width < 1920 || skia.height < 1080) {
      throw new Error(`Surface is smaller than the composition: Browser ${browser.width}x${browser.height}, Skia ${skia.width}x${skia.height}`);
    }

    const compare = (left: number, top: number, width: number, height: number) => {
      const x0 = Math.max(0, Math.floor(left));
      const y0 = Math.max(0, Math.floor(top));
      const x1 = Math.min(1920, Math.ceil(left + width));
      const y1 = Math.min(1080, Math.ceil(top + height));
      let changedPixels = 0;
      let totalDelta = 0;
      let maxChannelDelta = 0;
      let pixelCount = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const browserIndex = (y * browser.width + x) * 4;
          const skiaIndex = (y * skia.width + x) * 4;
          const delta = Math.max(
            Math.abs(browser.pixels[browserIndex]! - skia.pixels[skiaIndex]!),
            Math.abs(browser.pixels[browserIndex + 1]! - skia.pixels[skiaIndex + 1]!),
            Math.abs(browser.pixels[browserIndex + 2]! - skia.pixels[skiaIndex + 2]!),
            Math.abs(browser.pixels[browserIndex + 3]! - skia.pixels[skiaIndex + 3]!),
          );
          if (delta > 8) changedPixels += 1;
          totalDelta += delta;
          maxChannelDelta = Math.max(maxChannelDelta, delta);
          pixelCount += 1;
        }
      }
      return {
        changedPixels,
        changedRatio: pixelCount > 0 ? changedPixels / pixelCount : 0,
        meanAbsoluteDelta: pixelCount > 0 ? totalDelta / pixelCount : 0,
        maxChannelDelta,
      };
    };

    const full = compare(0, 0, 1920, 1080);
    let paintedPixels = 0;
    for (let y = 0; y < 1080; y += 1) {
      for (let x = 0; x < 1920; x += 1) {
        if (skia.pixels[(y * skia.width + x) * 4 + 3]! > 0) paintedPixels += 1;
      }
    }
    return {
      width: 1920,
      height: 1080,
      ...full,
      paintedPixels,
      regions: requestedRegions.map((region) => ({ ...region, ...compare(region.x, region.y, region.width, region.height) })),
    };
  }, { browserUrl: dataUrl(browserPng), skiaUrl: dataUrl(skiaPng), regions });
}

async function readContract(canvas: Locator): Promise<SurfaceContract> {
  return canvas.evaluate((element) => {
    const node = element as HTMLCanvasElement;
    return {
      backend: node.dataset.backend ?? null,
      previewState: node.dataset.previewState ?? null,
      width: node.width,
      height: node.height,
      runtimeFrame: Number(node.dataset.runtimeFrame ?? -1),
      runtimeTime: Number(node.dataset.runtimeTime ?? -1),
      runtimeCommandCount: Number(node.dataset.runtimeCommandCount ?? 0),
      runtimeLayerCount: Number(node.dataset.runtimeLayerCount ?? 0),
      drawCalls: Number(node.dataset.drawCalls ?? 0),
      skippedCommands: Number(node.dataset.skippedCommands ?? 0),
      diagnostics: node.dataset.diagnostics ?? "",
    };
  });
}

async function captureNativeSurface(page: Page, surface: Locator): Promise<Buffer> {
  const box = await surface.boundingBox();
  if (!box) throw new Error("Native surface bounds are unavailable");
  return page.screenshot({
    type: "png",
    clip: { x: box.x, y: box.y, width: WIDTH, height: HEIGHT },
  });
}

async function setNativeTime(page: Page, value: number): Promise<void> {
  const slider = page.getByTestId("radial-native-time-slider");
  await slider.focus();
  await slider.press("Home");
  for (let step = 0; step < Math.round(value * 30); step += 1) await slider.press("ArrowRight");
  await expect.poll(async () => Number(await page.getByTestId("radial-native-skia-canvas").getAttribute("data-runtime-time"))).toBeCloseTo(value, 5);
}

test("Phase 7/8 compares combined fixtures at fixed frames and records diagnostics", async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync(REPORT_ROOT, { recursive: true });
  // Keep the composition at 1920x1080, but leave room for the page scrollbar
  // and panel boundary so a clipped screenshot cannot lose the last column.
  await page.setViewportSize({ width: 2200, height: 3000 });
  await page.goto("/playground/native-stage", { waitUntil: "domcontentloaded" });

  const picker = page.getByTestId("radial-native-case-picker");
  const browser = page.getByTestId("radial-native-browser-iframe");
  const skia = page.getByTestId("radial-native-skia-canvas");
  await expect(picker).toBeEnabled({ timeout: 30_000 });

  const report: Array<{ fixture: string; time: number; browserSize: { width: number; height: number }; skia: SurfaceContract; diff: PixelDiff }> = [];
  for (const fixture of FIXTURES) {
    await picker.selectOption(fixture);
    await expect(picker).toHaveValue(fixture);
    await expect(skia).toHaveAttribute("data-backend", "skia", { timeout: 30_000 });
    await expect(skia).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    await expect(browser).toBeVisible();

    for (const time of SAMPLE_FRAMES) {
      await setNativeTime(page, time);
      await expect.poll(async () => Number(await skia.getAttribute("data-draw-calls"))).toBeGreaterThan(0);
      const contract = await readContract(skia);
      expect(contract.width, `${fixture} width`).toBe(WIDTH);
      expect(contract.height, `${fixture} height`).toBe(HEIGHT);
      expect(contract.runtimeCommandCount, `${fixture} command count`).toBeGreaterThan(0);
      expect(contract.runtimeLayerCount, `${fixture} layer count`).toBeGreaterThan(0);
      expect(contract.skippedCommands, `${fixture} skipped commands`).toBe(0);
      expect(contract.diagnostics, `${fixture} diagnostics`).not.toMatch(/unsupported|missing|error/i);

      const browserPng = await captureNativeSurface(page, browser);
      const skiaPng = await captureNativeSurface(page, skia);
      const browserSize = await page.evaluate(async (url) => {
        const response = await fetch(url);
        const bitmap = await createImageBitmap(await response.blob());
        const size = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return size;
      }, dataUrl(browserPng));
      expect(browserSize).toEqual({ width: WIDTH, height: HEIGHT });
      const diff = await compareScreenshots(page, browserPng, skiaPng, REGIONS[fixture]);
      expect(diff.width, `${fixture} diff width`).toBe(WIDTH);
      expect(diff.height, `${fixture} diff height`).toBe(HEIGHT);
      expect(diff.paintedPixels, `${fixture} painted pixels`).toBeGreaterThan(0);
      // Phase 7 records the first visual baseline before enforcing per-fixture
      // parity budgets. Keep only a catastrophic-render guard here so one
      // divergent fixture does not hide the remaining contract report.
      expect(diff.changedRatio, `${fixture} catastrophic pixel divergence`).toBeLessThan(0.98);
      expect(diff.meanAbsoluteDelta, `${fixture} catastrophic mean delta`).toBeLessThan(90);

      const prefix = `${fixture}-${String(Math.round(time * 30)).padStart(2, "0")}`;
      writeFileSync(resolve(REPORT_ROOT, `${prefix}.browser.png`), browserPng);
      writeFileSync(resolve(REPORT_ROOT, `${prefix}.skia.png`), skiaPng);
      report.push({ fixture, time, browserSize, skia: contract, diff });
    }
  }
  writeFileSync(resolve(REPORT_ROOT, "report.json"), JSON.stringify({ width: WIDTH, height: HEIGHT, frames: SAMPLE_FRAMES, results: report }, null, 2));
  expect(report).toHaveLength(FIXTURES.length * SAMPLE_FRAMES.length);
});
