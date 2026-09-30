import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

// Maps 1:1 to Chrome's box-shadow spread algorithm (Blink's
// ApplySpreadToShadowShape / OutsetWithCornerCorrection + ConstrainRadii in
// box_painter_base.cc): grow the rect and corner radius by `spread` on every
// side, then clamp the radius to [0, half of the smallest new side] - only
// non-trivial when spread is negative enough to push (radius+spread) below
// zero. The three fixtures below (moved into the permanent effect/
// catalog - see box-shadow-spread-shapes.html's own header comment for the
// full geometry rationale) cover shape correctness, magnitude/corner-radius
// sweeps, and which effects.ts code path a spread renders through.
// Compositions here vary in size (the sweeps fixture stacks 7 rows), so
// dimensions are read from each fixture's own rendered surface rather than
// assumed - see captureNativeSurface below.
const REPORT_ROOT = resolve(process.cwd(), "..", "..", "tmp", "box-shadow-spread-comparison");

const CASES = [
  "box-shadow-spread-shapes",
  "box-shadow-spread-sweeps",
  "box-shadow-spread-routing",
] as const;

type Diff = {
  width: number;
  height: number;
  changedPixels: number;
  changedRatio: number;
  meanAbsoluteDelta: number;
};

function dataUrl(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function comparePixels(page: Page, left: Buffer, right: Buffer, threshold: number): Promise<Diff> {
  return page.evaluate(async ({ leftUrl, rightUrl, threshold: pixelThreshold }) => {
    const decode = async (url: string) => {
      const response = await fetch(url);
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
      bitmap.close();
      return canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height);
    };
    const [leftImage, rightImage] = await Promise.all([decode(leftUrl), decode(rightUrl)]);
    if (!leftImage || !rightImage) throw new Error("Pixel comparison canvas is unavailable");
    if (leftImage.width !== rightImage.width || leftImage.height !== rightImage.height) {
      throw new Error("Pixel comparison surfaces must have identical dimensions");
    }

    let changedPixels = 0;
    let totalDelta = 0;
    const totalPixels = leftImage.width * leftImage.height;
    for (let i = 0; i < leftImage.data.length; i += 4) {
      const delta = Math.max(
        Math.abs(leftImage.data[i]! - rightImage.data[i]!),
        Math.abs(leftImage.data[i + 1]! - rightImage.data[i + 1]!),
        Math.abs(leftImage.data[i + 2]! - rightImage.data[i + 2]!),
        Math.abs(leftImage.data[i + 3]! - rightImage.data[i + 3]!),
      );
      if (delta > pixelThreshold) changedPixels += 1;
      totalDelta += delta;
    }
    return {
      width: leftImage.width,
      height: leftImage.height,
      changedPixels,
      changedRatio: totalPixels ? changedPixels / totalPixels : 0,
      meanAbsoluteDelta: totalPixels ? totalDelta / totalPixels : 0,
    };
  }, { leftUrl: dataUrl(left), rightUrl: dataUrl(right), threshold });
}

// Captures the surface at its own rendered size rather than an assumed
// composition size - box-shadow-spread-sweeps.html alone is 1920x3060 while
// the other two are 1920x1080/1920x1140, and stacked layout renders every
// composition at native 1:1 regardless of size.
async function captureNativeSurface(page: Page, surface: Locator): Promise<{ png: Buffer; width: number; height: number }> {
  await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();
  if (!box) throw new Error("Native surface bounds are unavailable");
  const png = await page.screenshot({ type: "png", clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
  return { png, width: box.width, height: box.height };
}

test("compares the three box-shadow spread geometry regimes against real Chrome", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(REPORT_ROOT, { recursive: true });
  // Tall enough to render box-shadow-spread-sweeps.html's 1920x3060
  // composition without needing an in-page scroll before the screenshot -
  // Playwright's clip is viewport-relative, so a surface taller than the
  // viewport would still get cut off after scrollIntoViewIfNeeded.
  await page.setViewportSize({ width: 2200, height: 3200 });
  await page.goto("/debug/native-stage", { waitUntil: "domcontentloaded" });

  const groupPicker = page.getByTestId("radial-native-group-picker");
  const picker = page.getByTestId("radial-native-case-picker");
  const browser = page.getByTestId("radial-native-browser-iframe");
  const skia = page.getByTestId("radial-native-skia-canvas");
  await expect(picker).toBeEnabled({ timeout: 30_000 });
  // The fixture picker is filtered by folder - these fixtures live in
  // "effect" (moved out of "debug" once the underlying spread-geometry bug
  // was confirmed fixed), and the picker only lists options for the
  // currently selected folder.
  await groupPicker.selectOption("effect");
  // Stacked layout renders both panels at native 1:1 (no CSS scale-down),
  // which the native-size clip in captureNativeSurface assumes. Side-by-side
  // scales both panels down to fit, so a 1:1 pixel clip would run off the
  // smaller panel's edge.
  await page.getByTestId("compare-layout-stacked").click();

  const report: Array<{ fixture: string; browserVsSkia: Diff }> = [];
  for (const fixture of CASES) {
    await picker.selectOption(fixture);
    await expect(picker).toHaveValue(fixture);
    await expect(skia).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    await expect(skia).toHaveAttribute("data-backend", "skia");
    // The whole point of this fixture set is the spread+dilate/erode path;
    // a diagnostics regression (e.g. falling back to skia_effect_unsupported)
    // must fail loudly here instead of silently rendering an empty halo.
    // "renderer_backend_selected" is informational and present on every
    // healthy render, so only unsupported/error codes are disallowed.
    const diagnostics = await skia.getAttribute("data-diagnostics");
    expect(diagnostics ?? "").not.toMatch(/unsupported|surface_unavailable|snapshot_unsupported|missing/);

    const browserCapture = await captureNativeSurface(page, browser);
    const skiaCapture = await captureNativeSurface(page, skia);
    expect(skiaCapture, `${fixture} browser/skia surface size mismatch`).toMatchObject({ width: browserCapture.width, height: browserCapture.height });
    const diff = await comparePixels(page, browserCapture.png, skiaCapture.png, 8);
    expect(diff).toMatchObject({ width: browserCapture.width, height: browserCapture.height });
    expect(diff.changedRatio, `${fixture} catastrophic pixel divergence`).toBeLessThan(0.98);
    writeFileSync(resolve(REPORT_ROOT, `${fixture}.browser.png`), browserCapture.png);
    writeFileSync(resolve(REPORT_ROOT, `${fixture}.skia.png`), skiaCapture.png);
    report.push({ fixture, browserVsSkia: diff });
  }

  writeFileSync(resolve(REPORT_ROOT, "report.json"), JSON.stringify({ report }, null, 2));
  expect(report).toHaveLength(CASES.length);
});
