import { expect, test } from "@playwright/test";
import { SKIA_TRANSFORM_CASES } from "../lib/docs/skia-preview-fixtures";
import { readSkiaDiff } from "./skia-pixel-diff";

test.describe("Skia transform contract", () => {
  test("renders translation, scale/anchor, rotation, skew, and nested transforms", async ({ page }) => {
    await page.goto("/docs/preview/skia");
    const select = page.locator("#runtime-skia-case");
    const canvas = page.getByTestId("skia-runtime-stage");

    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    for (const fixture of SKIA_TRANSFORM_CASES) {
      await select.selectOption(fixture.id);
      await expect(select).toHaveValue(fixture.id);
      await expect(canvas).toHaveAttribute("data-backend", "skia", { timeout: 30_000 });
      await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
      await expect.poll(async () => Number(await canvas.getAttribute("data-draw-calls")), `${fixture.id} draw calls`).toBeGreaterThan(0);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_command_unsupported/);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /current_3d_unsupported/);

      const diff = await readSkiaDiff(page);
      expect(diff.paintedPixels, `${fixture.id} painted pixels`).toBeGreaterThan(0);
      expect(diff.changedRatio, `${fixture.id} changed ratio`).toBeLessThan(0.08);
      expect(diff.meanAbsoluteDelta, `${fixture.id} mean delta`).toBeLessThan(10);
    }
  });
});
