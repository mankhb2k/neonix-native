import { expect, test } from "@playwright/test";

test.describe("HTML compiler matrix and backdrop-filter", () => {
  test("compiles matrix() and matrix3d() into ordered transform atoms", async ({ page }) => {
    await page.goto("/docs/preview/html-compiler?case=html-compiler.perspective.matrix-functions", { waitUntil: "domcontentloaded" });
    const canvas = page.getByTestId("html-compiler-runtime-canvas");
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    const protocol = (await page.locator("pre").last().textContent()) ?? "";
    expect(protocol).toContain('"type": "matrix"');
    expect(protocol).toContain('"name": "motion.matrix4"');
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /unsupported|fallback/);
  });

  test("keeps backdrop-filter separate from filter and renders a colored backdrop", async ({ page }) => {
    await page.goto("/docs/preview/html-compiler?case=html-compiler.perspective.backdrop-filter-blur", { waitUntil: "domcontentloaded" });
    const canvas = page.getByTestId("html-compiler-runtime-canvas");
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    const protocol = (await page.locator("pre").last().textContent()) ?? "";
    expect(protocol).toContain('"backdropEffects"');
    expect(protocol).toContain('"type": "blur"');
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_backdrop_filter_unsupported|unsupported|fallback/);
    await expect.poll(async () => Number(await canvas.getAttribute("data-draw-calls"))).toBeGreaterThan(0);
  });
});
