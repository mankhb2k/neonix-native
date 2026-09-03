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

const TOTAL_SKIA_CASES = [
  ...SKIA_PREVIEW_CASES,
  ...SKIA_GRADIENT_CASES,
  ...SKIA_IMAGE_CASES,
  ...SKIA_VIDEO_CASES,
  ...SKIA_TEXT_CASES,
  ...SKIA_COMPOSITING_CASES,
  ...SKIA_CLIP_CASES,
  ...SKIA_MASK_CASES,
  ...SKIA_EFFECT_CASES,
].length;

async function selectCase(page: Page, id: string) {
  const select = page.locator("#runtime-skia-case");
  const canvas = page.getByTestId("skia-runtime-stage");
  await select.selectOption(id);
  await expect(select).toHaveValue(id);
  await expect(canvas).toHaveAttribute("data-backend", "skia", { timeout: 30_000 });
  await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
  await expect.poll(async () => Number(await canvas.getAttribute("data-draw-calls")), `${id} draw calls`).toBeGreaterThan(0);
  return canvas;
}

test.describe("Skia Phase 6 Runtime compositing contract", () => {
  test("replays blend/isolation through Skia saveLayer and matches the same Runtime SVG fixture", async ({ page }) => {
    await page.goto("/docs/preview/skia");
    const select = page.locator("#runtime-skia-case");
    const canvas = page.getByTestId("skia-runtime-stage");
    await expect(select.locator("option")).toHaveCount(TOTAL_SKIA_CASES);

    for (const fixture of SKIA_COMPOSITING_CASES) {
      await selectCase(page, fixture.id);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_command_unsupported/);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_blend_unsupported/);
      const diff = await readSkiaDiff(page);
      expect(diff.paintedPixels, `${fixture.id} painted pixels`).toBeGreaterThan(0);
      if (fixture.id.startsWith("composite.blend.")) {
        // JPEG resampling plus CSS mix-blend-mode and Skia's raster filter
        // produce a larger image delta than vector-only isolation cases.
        expect(diff.changedRatio, `${fixture.id} changed ratio`).toBeLessThan(0.32);
        expect(diff.meanAbsoluteDelta, `${fixture.id} mean delta`).toBeLessThan(30);
      } else {
        expect(diff.changedRatio, `${fixture.id} changed ratio`).toBeLessThan(0.06);
        expect(diff.meanAbsoluteDelta, `${fixture.id} mean delta`).toBeLessThan(9);
      }
    }
  });

  test("replays Runtime clipPath source geometry without painting the source node", async ({ page }) => {
    await page.goto("/docs/preview/skia");
    const canvas = page.getByTestId("skia-runtime-stage");
    for (const fixture of SKIA_CLIP_CASES) {
      await selectCase(page, fixture.id);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_clip_path_unsupported/);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_command_unsupported/);
      const diff = await readSkiaDiff(page);
      expect(diff.paintedPixels, `${fixture.id} painted pixels`).toBeGreaterThan(0);
      expect(diff.changedRatio, `${fixture.id} changed ratio`).toBeLessThan(0.3);
      expect(diff.meanAbsoluteDelta, `${fixture.id} mean delta`).toBeLessThan(30);
    }
  });

  test("replays alpha/luma masks and the supported Runtime effect graph through Skia", async ({ page }) => {
    await page.goto("/docs/preview/skia");
    const select = page.locator("#runtime-skia-case");
    const canvas = page.getByTestId("skia-runtime-stage");
    for (const fixture of SKIA_MASK_CASES) {
      const select = page.locator("#runtime-skia-case");
      await select.selectOption(fixture.id);
      await expect(select).toHaveValue(fixture.id);
      await expect(canvas).toHaveAttribute("data-backend", "skia", { timeout: 30_000 });
      await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
      await expect.poll(async () => Number(await canvas.getAttribute("data-draw-calls"))).toBeGreaterThan(0);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_mask_unsupported/);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_mask_source_unsupported/);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_command_unsupported/);
      const diff = await readSkiaDiff(page);
      expect(diff.paintedPixels, `${fixture.id} painted pixels`).toBeGreaterThan(0);
      expect(diff.changedRatio, `${fixture.id} changed ratio`).toBeLessThan(0.2);
      expect(diff.meanAbsoluteDelta, `${fixture.id} mean delta`).toBeLessThan(22);
    }
    const supportedEffects = SKIA_EFFECT_CASES.filter((item) => item.id !== "effect.outer-glow.perspective");
    for (const fixture of supportedEffects) {
      await selectCase(page, fixture.id);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_effect_unsupported/);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_command_unsupported/);
      const diff = await readSkiaDiff(page);
      expect(diff.paintedPixels, `${fixture.id} painted pixels`).toBeGreaterThan(0);
      expect(diff.changedRatio, `${fixture.id} changed ratio`).toBeLessThan(0.35);
      expect(diff.meanAbsoluteDelta, `${fixture.id} mean delta`).toBeLessThan(36);
    }
    for (const fixture of SKIA_EFFECT_CASES.filter((item) => item.id === "effect.outer-glow.perspective")) {
      await select.selectOption(fixture.id);
      await expect(select).toHaveValue(fixture.id);
      await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
      await expect(canvas).toHaveAttribute("data-diagnostics", /current_3d_unsupported/);
    }
  });
});
