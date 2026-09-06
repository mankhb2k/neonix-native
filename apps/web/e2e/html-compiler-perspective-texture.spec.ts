import { expect, test } from "@playwright/test";

const cases = [
  "image-contain-rotate-y",
  "image-cover-off-center",
  "image-alpha-tilt",
  "video-projective-quad",
  "media-object-position",
  "image-composition-edge",
  "image-clip-path",
  "video-opacity-blend",
  "image-animated-z",
  "image-near-plane",
  "nested-image-perspective",
  "image-high-distortion",
] as const;

test.describe("HTML compiler Phase 8 projective textures", () => {
  for (const id of cases) {
    test(`${id} renders an image/video surface through the projective path`, async ({ page }) => {
      await page.goto(`/docs/preview/html-compiler?case=html-compiler.texture.${id}`, { waitUntil: "domcontentloaded" });

      const canvas = page.getByTestId("html-compiler-runtime-canvas");
      const browserStage = page.getByTestId("html-compiler-browser-stage");
      const runtimeStage = page.getByTestId("html-compiler-runtime-stage");
      const protocol = page.locator("pre").last();
      await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
      await expect(browserStage).toBeVisible();
      await expect(runtimeStage).toBeVisible();
      await expect.poll(async () => (await protocol.textContent()) ?? "").toMatch(/\"kind\": \"(image|video)\"/);
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_command_unsupported|preview_asset_missing|current_3d_unsupported/);
      await expect.poll(async () => Number(await canvas.getAttribute("data-draw-calls"))).toBeGreaterThan(0);
      const uploadAttribute = id.startsWith("video") ? "data-skia-video-texture-uploads" : "data-skia-texture-uploads";
      await expect.poll(async () => Number(await canvas.getAttribute(uploadAttribute))).toBeGreaterThan(0);
    });
  }

  test("keeps the browser and Skia panes on the shared animated playhead", async ({ page }) => {
    await page.goto("/docs/preview/html-compiler?case=html-compiler.texture.image-animated-z", { waitUntil: "domcontentloaded" });
    const canvas = page.getByTestId("html-compiler-runtime-canvas");
    const slider = page.getByTestId("html-compiler-skia-transport-time-slider");
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    const duration = Number(await slider.getAttribute("max"));
    await slider.evaluate((element, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, String(duration / 2));
    const actualTime = Number(await slider.inputValue());
    await expect(page.getByTestId("html-compiler-skia-preview-time")).toHaveAttribute("data-time", actualTime.toFixed(6));
    await expect(page.getByTestId("html-compiler-browser-preview-time")).toHaveAttribute("data-time", actualTime.toFixed(6));
    await page.screenshot({ path: "test-results-motion-path/phase8-projective-texture-mid.png", fullPage: true });
  });
});
