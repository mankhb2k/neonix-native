import { expect, test } from "@playwright/test";
import { SKIA_CLIP_CASES, SKIA_COMPOSITING_CASES, SKIA_EFFECT_CASES, SKIA_GRADIENT_CASES, SKIA_IMAGE_CASES, SKIA_MASK_CASES, SKIA_PREVIEW_CASES, SKIA_TEXT_CASES, SKIA_TRANSFORM_CASES, SKIA_VIDEO_CASES } from "../lib/docs/skia-preview-fixtures";
import { readSkiaDiff } from "./skia-pixel-diff";

test.describe("Skia Phase 2 Runtime path baseline", () => {
  test("renders all eight Protocol V2 path fixtures and passes SVG pixel diff", async ({ page }) => {
    await page.goto("/docs/preview/skia");
    const select = page.locator("#runtime-skia-case");
    const canvas = page.getByTestId("skia-runtime-stage");
    await expect(select.locator("option")).toHaveCount(SKIA_PREVIEW_CASES.length + SKIA_TRANSFORM_CASES.length + SKIA_GRADIENT_CASES.length + SKIA_IMAGE_CASES.length + SKIA_VIDEO_CASES.length + SKIA_TEXT_CASES.length + SKIA_COMPOSITING_CASES.length + SKIA_CLIP_CASES.length + SKIA_MASK_CASES.length + SKIA_EFFECT_CASES.length);
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });

    for (const fixture of SKIA_PREVIEW_CASES) {
      await select.selectOption(fixture.id);
      await expect(select).toHaveValue(fixture.id);
      await expect(canvas).toHaveAttribute("data-backend", "skia", { timeout: 30_000 });
      await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
      await expect.poll(async () => Number(await canvas.getAttribute("data-draw-calls"))).toBeGreaterThan(0);
      await expect.poll(async () => await canvas.getAttribute("data-diagnostics") ?? "").not.toContain("skia_command_unsupported");
      await expect.poll(async () => (await readSkiaDiff(page)).paintedPixels).toBeGreaterThan(0);

      const diff = await readSkiaDiff(page);
      expect(diff.width).toBe(await canvas.evaluate((element) => element.width));
      expect(diff.height).toBe(await canvas.evaluate((element) => element.height));
      expect(diff.changedRatio, `${fixture.id} changed ratio`).toBeLessThan(0.02);
      expect(diff.meanAbsoluteDelta, `${fixture.id} mean delta`).toBeLessThan(2.5);
    }
  });
});
