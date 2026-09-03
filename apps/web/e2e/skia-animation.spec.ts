import { expect, test } from "@playwright/test";
import { SKIA_ANIMATION_CASES } from "../lib/docs/skia-preview-fixtures";
import { readSkiaDiff } from "./skia-pixel-diff";

test.describe("Skia Protocol V2 animation contract", () => {
  test("samples JSON tracks and layer timing through the Skia preview", async ({ page }) => {
    await page.goto("/docs/preview/skia");
    const select = page.locator("#runtime-skia-case");
    const canvas = page.getByTestId("skia-runtime-stage");
    const time = page.getByTestId("skia-preview-time");
    const toggle = page.getByTestId("skia-play-toggle");
    const slider = page.getByTestId("skia-time-slider");

    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    for (const fixture of SKIA_ANIMATION_CASES) {
      expect(fixture.project.layers.some((layer) => (layer.tracks?.length ?? 0) > 0 || layer.timing.start > 0)).toBeTruthy();
      await select.selectOption(fixture.id);
      await expect(select).toHaveValue(fixture.id);
      await expect(canvas).toHaveAttribute("data-backend", "skia", { timeout: 30_000 });
      await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
      await expect.poll(async () => Number(await canvas.getAttribute("data-draw-calls")), `${fixture.id} draw calls`).toBeGreaterThan(0);

      const initialTime = Number(await time.getAttribute("data-time"));
      const before = await canvas.screenshot();
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-label", "Pause preview");
      await expect.poll(async () => Number(await time.getAttribute("data-time")), `${fixture.id} playhead advances`).toBeGreaterThan(initialTime + 0.15);
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-label", "Play preview");

      if (fixture.id !== "animation.timing-stagger") {
        const after = await canvas.screenshot();
        expect(after.equals(before), `${fixture.id} canvas changes while playing`).toBeFalsy();
      }

      const diff = await readSkiaDiff(page);
      expect(diff.paintedPixels, `${fixture.id} painted pixels`).toBeGreaterThan(0);
      expect(diff.changedRatio, `${fixture.id} SVG/Skia changed ratio`).toBeLessThan(0.08);
      expect(diff.meanAbsoluteDelta, `${fixture.id} SVG/Skia mean delta`).toBeLessThan(10);
    }

    await select.selectOption("animation.timing-stagger");
    await slider.fill("1.6");
    await expect(time).toHaveAttribute("data-time", "1.600000");
    const staggered = await canvas.screenshot();
    expect(staggered.length).toBeGreaterThan(0);
    const timingDiff = await readSkiaDiff(page);
    expect(timingDiff.paintedPixels).toBeGreaterThan(0);
    expect(timingDiff.changedRatio).toBeLessThan(0.08);
    expect(timingDiff.meanAbsoluteDelta).toBeLessThan(10);
  });
});
