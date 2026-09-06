import { expect, test } from "@playwright/test";

const cases = [
  "line-distance",
  "cubic-auto",
  "reverse-anchor",
  "clip-edge",
] as const;

test.describe("HTML compiler motion path", () => {
  for (const fixture of cases) {
    test(`${fixture} lowers CSS to Protocol V2 and paints in Skia`, async ({ page }) => {
      await page.goto(`/docs/preview/html-compiler?case=html-compiler.motion-path.${fixture}`, { waitUntil: "domcontentloaded" });
      const canvas = page.getByTestId("html-compiler-runtime-canvas");
      await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
      await expect(page.getByTestId("html-compiler-browser-stage")).toBeVisible();
      await expect(page.getByTestId("html-compiler-runtime-stage")).toBeVisible();
      await expect(page.locator("pre").last()).toContainText("offsetPath");

      const slider = page.getByTestId("html-compiler-skia-transport-time-slider");
      await slider.evaluate((element: HTMLInputElement) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        setter.call(element, String(Number(element.max) / 2));
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await expect(page.getByTestId("html-compiler-skia-preview-time")).not.toHaveAttribute("data-time", "0.000000");
      await expect.poll(async () => canvas.evaluate((element: HTMLCanvasElement) => {
        const context = element.getContext("2d");
        if (!context) return 0;
        const pixels = context.getImageData(0, 0, element.width, element.height).data;
        let changed = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index] !== 8 || pixels[index + 1] !== 16 || pixels[index + 2] !== 24) changed += 1;
        }
        return changed;
      })).toBeGreaterThan(100);
    });
  }
});
