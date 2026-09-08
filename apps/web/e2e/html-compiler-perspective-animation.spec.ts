import { expect, test } from "@playwright/test";

const cases = [
  ["animation-distance-linear", "distance"],
  ["animation-distance-cubic", "distance"],
  ["animation-distance-steps", "distance"],
  ["animation-origin-corner", "origin"],
  ["animation-origin-xy", "origin"],
  ["animation-delay-backwards", "distance"],
  ["animation-alternate", "distance"],
  ["animation-paused", "origin"],
  ["animation-rotate", "distance"],
  ["animation-nested-origin", "origin"],
  ["animation-origin-outside", "origin"],
  ["animation-sibling-tracks", "origin"],
] as const;

test.describe("HTML compiler perspective animation cases", () => {
  for (const [id, animatedProperty] of cases) {
    test(`${id} lowers and samples the camera track`, async ({ page }) => {
      await page.goto(`/docs/preview/html-compiler?case=html-compiler.perspective.${id}`, { waitUntil: "domcontentloaded" });

      const canvas = page.getByTestId("html-compiler-runtime-canvas");
      const browserStage = page.getByTestId("html-compiler-browser-stage");
      const runtimeStage = page.getByTestId("html-compiler-runtime-stage");
      const protocol = page.locator("pre").last();
      await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
      await expect(browserStage).toBeVisible();
      await expect(runtimeStage).toBeVisible();
      await expect(protocol).toContainText(`render3d.perspective.${animatedProperty}`);

      const slider = page.getByTestId("html-compiler-skia-transport-time-slider");
      const duration = Number(await slider.getAttribute("max"));
      expect(duration).toBeGreaterThan(0);
      await slider.evaluate((element, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }, String(duration / 2));
      await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(0);
      const actualTime = Number(await slider.inputValue());
      await expect(page.getByTestId("html-compiler-skia-preview-time")).toHaveAttribute("data-time", actualTime.toFixed(6));
      await expect(page.getByTestId("html-compiler-browser-preview-time")).toHaveAttribute("data-time", actualTime.toFixed(6));

      const compilerPlay = page.getByTestId("html-compiler-skia-play-toggle");
      const browserPlay = page.getByTestId("html-compiler-browser-play-toggle");
      await compilerPlay.click();
      await expect(compilerPlay).toHaveAttribute("aria-pressed", "true");
      await expect(browserPlay).toHaveAttribute("aria-pressed", "true");
      await compilerPlay.click();
      await expect(compilerPlay).toHaveAttribute("aria-pressed", "false");
      await expect(browserPlay).toHaveAttribute("aria-pressed", "false");
    });
  }

  test("changes the Skia sample when the shared playhead is scrubbed", async ({ page }) => {
    await page.goto("/docs/preview/html-compiler?case=html-compiler.perspective.animation-distance-linear", { waitUntil: "domcontentloaded" });
    const canvas = page.getByTestId("html-compiler-runtime-canvas");
    const slider = page.getByTestId("html-compiler-skia-transport-time-slider");
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    const signature = () => canvas.evaluate((element: HTMLCanvasElement) => {
      const context = element.getContext("2d");
      if (!context) return "";
      const data = context.getImageData(0, 0, element.width, element.height).data;
      let hash = 2166136261;
      for (let index = 0; index < data.length; index += 97) {
        hash ^= data[index]!;
        hash = Math.imul(hash, 16777619);
      }
      return String(hash >>> 0);
    });
    const first = await signature();
    const duration = Number(await slider.getAttribute("max"));
    await slider.evaluate((element, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, String(duration / 2));
    await expect.poll(signature).not.toBe(first);
    const actualTime = Number(await slider.inputValue());
    await expect(page.getByTestId("html-compiler-browser-preview-time")).toHaveAttribute("data-time", actualTime.toFixed(6));
  });
});
