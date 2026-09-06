import { expect, test } from "@playwright/test";

const cases: Array<{ id: string; json: string; extra: string; painted?: boolean }> = [
  { id: "group-translate-z", json: "render3d", extra: "motion.translate3d" },
  { id: "rotate-x", json: "motion.rotateX", extra: "perspective" },
  { id: "origin-offset", json: "perspective", extra: "motion.rotateY" },
  { id: "flat-preserve-3d", json: "preserve-3d", extra: "render3d" },
  { id: "transform-function", json: "motion.perspective", extra: "motion.rotateY" },
  { id: "backface-hidden", json: "backfaceVisibility", extra: "hidden", painted: false },
  { id: "near-far-clipping", json: "perspective", extra: "motion.translate3d" },
  { id: "animated-3d", json: "transform.translate.z", extra: "tracks" },
  { id: "parallax-three-depths", json: "tracks", extra: "motion.translate3d" },
] as const;

test.describe("HTML compiler Phase 5 perspective", () => {
  for (const fixture of cases) {
    test(`${fixture.id} lowers CSS through Protocol V2 and paints in Skia`, async ({ page }) => {
      await page.goto(`/docs/preview/html-compiler?case=html-compiler.perspective.${fixture.id}`, { waitUntil: "domcontentloaded" });

      const canvas = page.getByTestId("html-compiler-runtime-canvas");
      await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
      await expect(page.getByTestId("html-compiler-browser-stage")).toBeVisible();
      await expect(page.getByTestId("html-compiler-runtime-stage")).toBeVisible();

      const protocol = page.locator("pre").last();
      await expect(protocol).toContainText(fixture.json);
      await expect(protocol).toContainText(fixture.extra);

      const paintedCount = () => canvas.evaluate((element: HTMLCanvasElement) => {
        const context = element.getContext("2d");
        if (!context) return 0;
        const pixels = context.getImageData(0, 0, element.width, element.height).data;
        let painted = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index] !== 8 || pixels[index + 1] !== 16 || pixels[index + 2] !== 24) painted += 1;
        }
        return painted;
      });
      if (fixture.painted === false) await expect.poll(paintedCount).toBe(0);
      else {
        await expect.poll(paintedCount).toBeGreaterThan(100);
        if (fixture.id === "near-far-clipping") {
          await expect(protocol).toContainText('"near": 1');
          const greenBounds = () => canvas.evaluate((element: HTMLCanvasElement) => {
            const context = element.getContext("2d");
            if (!context) return null;
            const pixels = context.getImageData(0, 0, element.width, element.height).data;
            let left = element.width;
            let top = element.height;
            let right = -1;
            let bottom = -1;
            for (let y = 0; y < element.height; y += 1) {
              for (let x = 0; x < element.width; x += 1) {
                const offset = (y * element.width + x) * 4;
                if (pixels[offset] === 52 && pixels[offset + 1] === 211 && pixels[offset + 2] === 153 && pixels[offset + 3] > 0) {
                  left = Math.min(left, x);
                  top = Math.min(top, y);
                  right = Math.max(right, x);
                  bottom = Math.max(bottom, y);
                }
              }
            }
            return right < 0 ? null : { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
          });
          await expect.poll(greenBounds).toMatchObject({ width: expect.any(Number) });
          const bounds = await greenBounds();
          expect(bounds).not.toBeNull();
          expect(bounds!.width).toBeGreaterThan(450);
          expect(bounds!.left).toBeLessThan(700);
          expect(bounds!.height).toBeGreaterThan(450);
        }
      }
    });
  }
});
