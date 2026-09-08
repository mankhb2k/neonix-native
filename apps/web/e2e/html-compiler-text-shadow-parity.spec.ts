import { expect, test, type TestInfo } from "@playwright/test";
import { measureShadowScreenshots, openShadowCase } from "./shadow-parity";

const cases = [
  ["html-compiler.paint.text-shadow-alpha", "alpha silhouette"],
  ["html-compiler.paint.text-shadow-blur", "blur only"],
  ["html-compiler.paint.text-shadow-offset", "offset only"],
  ["html-compiler.paint.text-shadow", "offset plus blur"],
] as const;

for (const [id, label] of cases) {
  test(`measures text-shadow ${label} browser versus Skia raster parity`, async ({ page }, testInfo: TestInfo) => {
    await openShadowCase(page, id);
    const measurement = await measureShadowScreenshots(page);
    await testInfo.attach("text-shadow-baseline.json", {
      body: JSON.stringify(measurement, null, 2),
      contentType: "application/json",
    });
    console.log(JSON.stringify({ id, ...measurement }));
    const protocol = await page.locator("pre").last().textContent();
    expect(protocol).toContain('"source": "alpha"');
    expect(await page.getByTestId("html-compiler-runtime-canvas").getAttribute("data-diagnostics")).not.toMatch(/unsupported|fallback/);
    expect(measurement.browser.haloPixels).toBeGreaterThan(0);
    expect(measurement.skia.haloPixels).toBeGreaterThan(0);
    // These are display-surface tolerances, intentionally looser than a
    // byte-for-byte golden: Browser and CanvasKit rasterize text with
    // different glyph coverage and blur kernels. The threshold still catches
    // a missing effect or a materially wrong shadow extent.
    expect(measurement.changedRatio).toBeLessThan(0.03);
    expect(measurement.meanAbsoluteDelta).toBeLessThan(1.5);
    if (!id.endsWith("-alpha")) {
      // A backend blur kernel may not reproduce Chrome's peak alpha exactly,
      // but it must retain at least 60% of the reference halo intensity.
      expect(measurement.skia.meanChroma / measurement.browser.meanChroma).toBeGreaterThan(0.6);
    }
  });
}
