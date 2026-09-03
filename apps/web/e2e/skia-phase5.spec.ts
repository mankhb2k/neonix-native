import { expect, test, type Page } from "@playwright/test";
import {
  SKIA_CLIP_CASES,
  SKIA_COMPOSITING_CASES,
  SKIA_EFFECT_CASES,
  SKIA_GRADIENT_CASES,
  SKIA_IMAGE_CASES,
  SKIA_MASK_CASES,
  SKIA_PREVIEW_CASES,
  SKIA_TEXT_CASES,
  SKIA_VIDEO_CASES,
} from "../lib/docs/skia-preview-fixtures";
import { readSkiaDiff } from "./skia-pixel-diff";

const TOTAL_SKIA_CASES =
  SKIA_PREVIEW_CASES.length +
  SKIA_GRADIENT_CASES.length +
  SKIA_IMAGE_CASES.length +
  SKIA_VIDEO_CASES.length +
  SKIA_TEXT_CASES.length +
  SKIA_COMPOSITING_CASES.length +
  SKIA_CLIP_CASES.length +
  SKIA_MASK_CASES.length +
  SKIA_EFFECT_CASES.length;

function resourceCounts(value: string | null): { activeAssets: number; activeVideos: number } {
  if (!value) return { activeAssets: 0, activeVideos: 0 };
  try {
    const parsed = JSON.parse(value) as { activeAssets?: number; activeVideos?: number };
    return {
      activeAssets: parsed.activeAssets ?? 0,
      activeVideos: parsed.activeVideos ?? 0,
    };
  } catch {
    return { activeAssets: 0, activeVideos: 0 };
  }
}

async function waitForSkiaCase(
  page: Page,
  fixtureId: string,
) {
  const select = page.locator("#runtime-skia-case");
  const canvas = page.getByTestId("skia-runtime-stage");
  await select.selectOption(fixtureId);
  await expect(select).toHaveValue(fixtureId);
  await expect(canvas).toHaveAttribute("data-backend", "skia", { timeout: 30_000 });
  await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
  return { canvas, select };
}

async function readPaintedRegion(page: Page): Promise<number> {
  return page.getByTestId("skia-runtime-stage").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const background = [pixels[0] ?? 0, pixels[1] ?? 0, pixels[2] ?? 0];
    let changed = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (
        Math.abs((pixels[index] ?? 0) - background[0]!) > 6 ||
        Math.abs((pixels[index + 1] ?? 0) - background[1]!) > 6 ||
        Math.abs((pixels[index + 2] ?? 0) - background[2]!) > 6
      ) changed++;
    }
    return changed;
  });
}

test.describe("Skia Phase 5 Protocol V2 resource contract", () => {
  test("renders public preview images through RuntimeFrameV3 and passes SVG pixel diff", async ({ page }) => {
    await page.goto("/docs/preview/skia");
    const select = page.locator("#runtime-skia-case");
    const canvas = page.getByTestId("skia-runtime-stage");
    await expect(select.locator("option")).toHaveCount(TOTAL_SKIA_CASES);
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });

    for (const fixture of SKIA_IMAGE_CASES.filter((item) => item.id !== "image.missing-asset")) {
      await waitForSkiaCase(page, fixture.id);
      await expect.poll(async () => resourceCounts(await canvas.getAttribute("data-preview-resource-counts")).activeAssets, `${fixture.id} active assets`).toBeGreaterThan(0);
      await expect.poll(async () => Number(await canvas.getAttribute("data-skia-texture-uploads")), `${fixture.id} Skia texture uploads`).toBeGreaterThan(0);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /preview_asset_missing/);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_command_unsupported/);
      await expect.poll(async () => (await readSkiaDiff(page)).paintedPixels, `${fixture.id} painted pixels`).toBeGreaterThan(0);

      const svgFrame = page.getByTestId("skia-svg-reference").contentFrame();
      if (!svgFrame) throw new Error(`SVG reference frame is missing for ${fixture.id}`);
      await expect.poll(() => svgFrame.locator(`svg[data-fixture="${fixture.id}"] image`).count()).toBeGreaterThan(0);
      const diff = await readSkiaDiff(page);
      expect(diff.width).toBe(Number(await canvas.getAttribute("width")));
      expect(diff.height).toBe(Number(await canvas.getAttribute("height")));
      // Raster images may be resampled by browser SVG and Skia through
      // different filters. Keep the gate strict enough to catch geometry or
      // missing-resource regressions while allowing valid filter differences.
      expect(diff.changedRatio, `${fixture.id} changed ratio`).toBeLessThan(0.1);
      // Cover/crop is the most filter-sensitive case because both engines
      // resample a portrait source after clipping it to the viewport.
      expect(diff.meanAbsoluteDelta, `${fixture.id} mean delta`).toBeLessThan(14);
      if (fixture.id === "image.preserve-aspect-ratio.meet") {
        const geometry = await canvas.evaluate(async (element) => {
          const canvas = element as HTMLCanvasElement;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Skia image context is missing");
          const source = new Image();
          source.src = "/preview/image/photo-landscape.jpg";
          await source.decode();
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          const background = [16, 24, 32];
          let left = canvas.width;
          let top = canvas.height;
          let right = 0;
          let bottom = 0;
          for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
            const index = (y * canvas.width + x) * 4;
            if (Math.abs(pixels[index]! - background[0]!) > 12 || Math.abs(pixels[index + 1]! - background[1]!) > 12 || Math.abs(pixels[index + 2]! - background[2]!) > 12) {
              left = Math.min(left, x);
              top = Math.min(top, y);
              right = Math.max(right, x);
              bottom = Math.max(bottom, y);
            }
          }
          return { naturalRatio: source.naturalWidth / source.naturalHeight, paintedRatio: (right - left + 1) / (bottom - top + 1), centerX: (left + right) / 2, canvasCenterX: canvas.width / 2 };
        });
        expect(geometry.paintedRatio, `${fixture.id} intrinsic ratio`).toBeCloseTo(geometry.naturalRatio, 1);
        expect(Math.abs(geometry.centerX - geometry.canvasCenterX), `${fixture.id} meet alignment`).toBeLessThan(1);
      }
    }
  });

  test("keeps a missing image fail-closed", async ({ page }) => {
    await page.goto("/docs/preview/skia");
    const { canvas } = await waitForSkiaCase(page, "image.missing-asset");
    await expect(canvas).toHaveAttribute("data-diagnostics", /preview_asset_missing/);
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /current_3d_unsupported/);
    await expect(canvas).toHaveAttribute("data-skia-texture-uploads", "0");
  });

  test("seeks public preview video resources before Skia replay", async ({ page }) => {
    await page.goto("/docs/preview/skia");
    const select = page.locator("#runtime-skia-case");
    const canvas = page.getByTestId("skia-runtime-stage");
    await expect(select.locator("option")).toHaveCount(TOTAL_SKIA_CASES);

    for (const fixture of SKIA_VIDEO_CASES) {
      await waitForSkiaCase(page, fixture.id);
      await expect.poll(async () => resourceCounts(await canvas.getAttribute("data-preview-resource-counts")).activeVideos, `${fixture.id} active videos`).toBeGreaterThan(0);
      await expect.poll(async () => Number(await canvas.getAttribute("data-skia-video-texture-uploads")), `${fixture.id} video texture uploads`).toBeGreaterThan(0);
      await expect.poll(async () => await canvas.getAttribute("data-video-times") ?? "", `${fixture.id} Runtime media time`).toMatch(/visible/);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /preview_asset_missing/);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_command_unsupported/);
      await expect.poll(async () => readPaintedRegion(page), `${fixture.id} painted region`).toBeGreaterThan(100);

      const videoTimes = await canvas.getAttribute("data-video-times");
      expect(videoTimes, `${fixture.id} video command metadata`).toMatch(/visible/);
      if (fixture.id === "video.multi-instance") {
        expect(videoTimes?.split(",")).toHaveLength(2);
      }
    }
  });
});
