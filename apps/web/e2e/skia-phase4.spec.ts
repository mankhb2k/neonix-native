import { expect, test } from "@playwright/test";
import { SKIA_CLIP_CASES, SKIA_COMPOSITING_CASES, SKIA_EFFECT_CASES, SKIA_GRADIENT_CASES, SKIA_IMAGE_CASES, SKIA_MASK_CASES, SKIA_PREVIEW_CASES, SKIA_TEXT_CASES, SKIA_TRANSFORM_CASES, SKIA_VIDEO_CASES } from "../lib/docs/skia-preview-fixtures";
import { readSkiaDiff } from "./skia-pixel-diff";

test.describe("Skia Phase 4 Runtime text and font contract", () => {
  test("renders normal text and emoji from prepared Runtime glyphs", async ({ page }) => {
    await page.goto("/docs/preview/skia");
    const select = page.locator("#runtime-skia-case");
    const canvas = page.getByTestId("skia-runtime-stage");
    await expect(select.locator("option")).toHaveCount(SKIA_PREVIEW_CASES.length + SKIA_TRANSFORM_CASES.length + SKIA_GRADIENT_CASES.length + SKIA_IMAGE_CASES.length + SKIA_VIDEO_CASES.length + SKIA_TEXT_CASES.length + SKIA_COMPOSITING_CASES.length + SKIA_CLIP_CASES.length + SKIA_MASK_CASES.length + SKIA_EFFECT_CASES.length);
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });

    for (const fixture of SKIA_TEXT_CASES) {
      await select.selectOption(fixture.id);
      await expect(select).toHaveValue(fixture.id);
      await expect(canvas).toHaveAttribute("data-backend", "skia", { timeout: 30_000 });
      await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
      await expect.poll(async () => Number(await canvas.getAttribute("data-runtime-glyphs")), `${fixture.id} runtime glyphs`).toBeGreaterThan(0);
      if (fixture.id === "text.single-line.alignment") {
        await expect.poll(async () => Number(await canvas.getAttribute("data-skia-native-text-glyphs")), "normal text uses Skia drawGlyphs").toBeGreaterThan(0);
      }
      if (fixture.id.startsWith("text.arabic.")) {
        await expect.poll(async () => Number(await canvas.getAttribute("data-skia-native-text-glyphs")), `${fixture.id} uses Runtime-shaped glyph IDs with Skia drawGlyphs`).toBeGreaterThan(0);
        await expect(canvas).toHaveAttribute("data-runtime-color-glyphs", "0");
      }
      if (fixture.id.startsWith("text.emoji-")) {
        await expect.poll(async () => Number(await canvas.getAttribute("data-runtime-color-glyphs")), `${fixture.id} color glyphs`).toBeGreaterThan(0);
        await expect.poll(async () => Number(await canvas.getAttribute("data-skia-native-color-text-glyphs")), `${fixture.id} uses native COLRv1 glyphs`).toBeGreaterThan(0);
        await expect.poll(async () => Number(await canvas.getAttribute("data-skia-text-assets")), `${fixture.id} decoded color glyph assets`).toBeGreaterThan(0);
      }
      await expect.poll(async () => Number(await canvas.getAttribute("data-draw-calls"))).toBeGreaterThan(0);
      await expect.poll(async () => await canvas.getAttribute("data-diagnostics") ?? "").not.toContain("skia_command_unsupported");
      const svgFrame = page.getByTestId("skia-svg-reference").contentFrame();
      await expect.poll(async () => svgFrame?.locator(`svg[data-fixture="${fixture.id}"] path, svg[data-fixture="${fixture.id}"] image`).count() ?? 0).toBeGreaterThan(0);
      await expect.poll(async () => svgFrame?.locator("svg path, svg image").count() ?? 0).toBeGreaterThan(0);

      const diff = await readSkiaDiff(page);
      expect(diff.width).toBe(await canvas.evaluate((element) => element.width));
      expect(diff.height).toBe(await canvas.evaluate((element) => element.height));
      expect(diff.paintedPixels, `${fixture.id} painted pixels`).toBeGreaterThan(0);
      expect(diff.changedRatio, `${fixture.id} changed ratio`).toBeLessThan(0.04);
      expect(diff.meanAbsoluteDelta, `${fixture.id} mean delta`).toBeLessThan(5);
    }
  });
});
