import { expect, test, type TestInfo } from "@playwright/test";
import { measureShadowScreenshots, openShadowCase, type ShadowMetrics } from "./shadow-parity";

const cases = [
  ["html-compiler.paint.filter-drop-shadow-alpha", "alpha silhouette"],
  ["html-compiler.paint.filter-drop-shadow-blur", "blur only"],
  ["html-compiler.paint.filter-drop-shadow-offset", "offset only"],
  ["html-compiler.paint.filter-drop-shadow", "offset plus blur"],
] as const;

function expectBoundsWithin(browser: ShadowMetrics, skia: ShadowMetrics, tolerance: number): void {
  expect(browser.bounds, "Browser shadow bounds").not.toBeNull();
  expect(skia.bounds, "Skia shadow bounds").not.toBeNull();
  if (!browser.bounds || !skia.bounds) return;
  expect(Math.abs(skia.bounds.left - browser.bounds.left)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(skia.bounds.top - browser.bounds.top)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(skia.bounds.right - browser.bounds.right)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(skia.bounds.bottom - browser.bounds.bottom)).toBeLessThanOrEqual(tolerance);
}

for (const [id, label] of cases) {
  test(`measures filter drop-shadow ${label} browser versus Skia raster parity`, async ({ page }, testInfo: TestInfo) => {
    await openShadowCase(page, id);
    const measurement = await measureShadowScreenshots(page);
    await testInfo.attach("filter-drop-shadow-baseline.json", {
      body: JSON.stringify(measurement, null, 2),
      contentType: "application/json",
    });
    console.log(JSON.stringify({ id, ...measurement }));

    const protocol = await page.locator("pre").last().textContent();
    expect(protocol).toContain('"type": "shadow"');
    expect(protocol).toContain('"source": "alpha"');
    expect(await page.getByTestId("html-compiler-runtime-canvas").getAttribute("data-diagnostics"))
      .not.toMatch(/unsupported|fallback/);
    if (!id.endsWith("-alpha")) {
      expect(measurement.browser.haloPixels).toBeGreaterThan(0);
      expect(measurement.skia.haloPixels).toBeGreaterThan(0);
    }

    // Display-surface acceptance criteria. Geometry is stricter than the
    // aggregate raster diff so a missing or displaced alpha shadow is caught.
    if (!id.endsWith("-alpha")) expectBoundsWithin(measurement.browser, measurement.skia, 6);
    // Filter output includes the rounded owner surface, so Chrome and
    // CanvasKit kernel coverage differs slightly more than text-shadow.
    expect(measurement.changedRatio).toBeLessThan(0.035);
    expect(measurement.meanAbsoluteDelta).toBeLessThan(1.5);
    if (!id.endsWith("-alpha")) {
      // CanvasKit and Chrome use different blur kernels, but the rendered
      // halo must retain a substantial portion of the reference chroma.
      expect(measurement.skia.meanChroma / measurement.browser.meanChroma).toBeGreaterThan(0.6);
    }
  });
}
