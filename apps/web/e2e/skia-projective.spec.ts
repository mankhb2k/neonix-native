import { expect, test } from "@playwright/test";
import { SKIA_PROJECTIVE_CASES } from "../lib/docs/skia-preview-fixtures";
import { readSkiaDiff } from "./skia-pixel-diff";

test.describe("Skia projective surface tessellation", () => {
  test("clips complex near-plane surfaces before perspective division and keeps SVG parity", async ({ page }) => {
    await page.goto("/docs/preview/skia");
    const select = page.locator("#runtime-skia-case");
    const canvas = page.getByTestId("skia-runtime-stage");

    for (const fixture of SKIA_PROJECTIVE_CASES) {
      await select.selectOption(fixture.id);
      await expect(select).toHaveValue(fixture.id);
      await expect(canvas).toHaveAttribute("data-backend", "skia", { timeout: 30_000 });
      await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
      await expect.poll(async () => Number(await canvas.getAttribute("data-draw-calls")), `${fixture.id} draw calls`).toBeGreaterThan(0);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /current_3d_unsupported|skia_command_unsupported/);

      const diff = await readSkiaDiff(page);
      expect(diff.paintedPixels, `${fixture.id} painted pixels`).toBeGreaterThan(0);
      // SVG and CanvasKit rasterize the clipped edge with different AA rules;
      // the filled surface and its cut must nevertheless remain the same image.
      expect(diff.changedRatio, `${fixture.id} changed ratio`).toBeLessThan(0.08);
      expect(diff.meanAbsoluteDelta, `${fixture.id} mean delta`).toBeLessThan(12);
    }
  });
});
