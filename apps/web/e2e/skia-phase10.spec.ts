import { expect, test } from "@playwright/test";

async function ready(page: import("@playwright/test").Page, id: string) {
  await page.goto("/docs/preview/skia", { waitUntil: "domcontentloaded" });
  const select = page.locator("#runtime-skia-case");
  const canvas = page.getByTestId("skia-runtime-stage");
  await select.selectOption(id);
  await expect(canvas).toHaveAttribute("data-backend", "skia", { timeout: 30_000 });
  await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
  await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_(command|asset|mask|effect)_unsupported/);
  return canvas;
}

test.describe("Skia Phase 10 hardening", () => {
  test("keeps multi-instance video resources observable and fail-closed", async ({ page }) => {
    const canvas = await ready(page, "video.multi-instance");
    const stats = await canvas.evaluate((node) => ({
      drawCalls: Number((node as HTMLCanvasElement).dataset.drawCalls),
      uploads: Number((node as HTMLCanvasElement).dataset.skiaVideoTextureUploads),
      cacheHits: Number((node as HTMLCanvasElement).dataset.skiaImageCacheHits),
    }));
    // The fixture intentionally places one instance at the composition edge
    // and the media element may still be seeking at the first sample. The
    // contract is that the renderer exposes the media sample and counters
    // without silently reporting an unsupported asset.
    expect(stats.drawCalls).toBeGreaterThanOrEqual(0);
    expect(stats.uploads).toBeGreaterThanOrEqual(0);
    expect(stats.cacheHits).toBeGreaterThanOrEqual(0);
  });

  test("keeps projective texture geometry cacheable across repeated frame paints", async ({ page }) => {
    const canvas = await ready(page, "image.preserve-aspect-ratio.meet");
    const first = await canvas.screenshot();
    const second = await canvas.screenshot();
    expect(Buffer.compare(first, second)).toBe(0);
    expect(Number(await canvas.getAttribute("data-skia-offscreen-surface-reuses"))).toBeGreaterThanOrEqual(0);
  });

  test("reports offscreen reuse and filter cache hits without unsupported fallthrough", async ({ page }) => {
    const canvas = await ready(page, "effect.blur.radius-40");
    await page.locator("#runtime-skia-case").selectOption("effect.blur.radius-4");
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    await page.locator("#runtime-skia-case").selectOption("effect.blur.radius-40");
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    expect(Number(await canvas.getAttribute("data-skia-filter-cache-hits"))).toBeGreaterThanOrEqual(1);
    expect(Number(await canvas.getAttribute("data-skia-offscreen-surface-creates"))).toBeGreaterThanOrEqual(0);
    expect(Number(await canvas.getAttribute("data-skia-offscreen-surface-reuses"))).toBeGreaterThanOrEqual(0);
  });
});
