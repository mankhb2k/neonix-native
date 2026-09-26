import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

// Maps 1:1 to Chrome's box-shadow spread algorithm (Blink's
// ApplySpreadToShadowShape / OutsetWithCornerCorrection + ConstrainRadii in
// box_painter_base.cc): grow the rect and corner radius by `spread` on every
// side, then clamp the radius to [0, half of the smallest new side]. Three
// cases isolate the three distinct arithmetic regimes instead of only ever
// exercising them tangled together inside a big composite scene:
//   - circle:      radius == min(w,h)/2 already - must stay self-consistent
//                  (a circle stays a circle) after growth.
//   - rounded-rect: radius << min(w,h)/2 - proves the upper clamp is
//                  mathematically a no-op for any valid CSS shape under
//                  positive spread (CSS never allows radius > min(w,h)/2 to
//                  begin with, and growth preserves that inequality).
//   - negative-erode: spread negative enough to push (radius+spread) below
//                  zero - the one regime where clamping (floor to 0) is not
//                  a no-op.
const WIDTH = 1920;
const HEIGHT = 1080;
const REPORT_ROOT = resolve(process.cwd(), "..", "..", "tmp", "box-shadow-spread-comparison");

const CASES = [
  // Foundation check first: offset-x/offset-y are box-shadow's most basic
  // components (pure translation, no shape change), kept at spread:0 to
  // stay on effects.ts's simplest recognizer and prove a clean 1:1 pixel
  // match against Chrome before anything spread-related.
  "box-shadow-offset-x-sweep",
  "box-shadow-offset-y-sweep",
  // Same foundation methodology applied to spread-radius: a plain rect
  // (cornerRadius:0) cannot show the corner-rounding squircle artifact
  // regardless of how the dilate kernel is shaped, so this isolates
  // whether spread's magnitude/direction math itself is correct.
  "box-shadow-spread-radius-sweep",
  "box-shadow-spread-circle",
  "box-shadow-spread-rounded-rect",
  "box-shadow-spread-negative-erode",
  // Case 1 (circle) deep-dive: a spread-magnitude sweep, an offset+spread
  // interaction check, and a 2-shadow-list pair (same CSS, forces the
  // sourceOnly route) now that boxShadowBranches() also recognizes a
  // leading spread branch.
  "box-shadow-spread-circle-2shadow-list",
  "box-shadow-spread-circle-magnitude-sweep",
  "box-shadow-spread-circle-offset",
  // Further characterizing the confirmed corner-radius+spread bug: severity
  // vs. how round the shape already is, which part of a shape it hits
  // (straight edges vs. rounded end-caps on a pill), and whether it still
  // matters at small icon/badge UI scale.
  "box-shadow-spread-corner-radius-sweep",
  "box-shadow-spread-pill-shape",
  "box-shadow-spread-small-scale-icon",
  // Digging into the residual mismatch spotted on the radius:0/spread:90
  // tile of spread-radius-sweep after the sourceOnly fix landed: isolated
  // for a clean crop, a radius-vs-spread relationship check, and an
  // extreme-magnitude stress test.
  "box-shadow-spread-sharp-rect-isolated",
  "box-shadow-spread-radius-vs-spread-relationship",
  "box-shadow-spread-extreme-large-spread",
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

async function captureNativeSurface(page: Page, surface: Locator): Promise<Buffer> {
  await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();
  if (!box) throw new Error("Native surface bounds are unavailable");
  return page.screenshot({ type: "png", clip: { x: box.x, y: box.y, width: WIDTH, height: HEIGHT } });
}

test("compares the three box-shadow spread geometry regimes against real Chrome", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(REPORT_ROOT, { recursive: true });
  await page.setViewportSize({ width: 2200, height: 3000 });
  await page.goto("/playground/native-stage", { waitUntil: "domcontentloaded" });

  const groupPicker = page.getByTestId("radial-native-group-picker");
  const picker = page.getByTestId("radial-native-case-picker");
  const browser = page.getByTestId("radial-native-browser-iframe");
  const skia = page.getByTestId("radial-native-skia-canvas");
  await expect(picker).toBeEnabled({ timeout: 30_000 });
  // The fixture picker is filtered by folder - our fixtures live in "debug",
  // and the picker only lists options for the currently selected folder.
  await groupPicker.selectOption("debug");
  // Stacked layout renders both panels at native 1:1 (no CSS scale-down),
  // which the fixed-size WIDTHxHEIGHT clip below assumes. Side-by-side
  // scales both panels down to fit, so the surfaces are no longer 1920x1080
  // and a 1920x1080 clip can run off the smaller panel's edge.
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

    const browserPng = await captureNativeSurface(page, browser);
    const skiaPng = await captureNativeSurface(page, skia);
    const diff = await comparePixels(page, browserPng, skiaPng, 8);
    expect(diff).toMatchObject({ width: WIDTH, height: HEIGHT });
    expect(diff.changedRatio, `${fixture} catastrophic pixel divergence`).toBeLessThan(0.98);
    writeFileSync(resolve(REPORT_ROOT, `${fixture}.browser.png`), browserPng);
    writeFileSync(resolve(REPORT_ROOT, `${fixture}.skia.png`), skiaPng);
    report.push({ fixture, browserVsSkia: diff });
  }

  writeFileSync(resolve(REPORT_ROOT, "report.json"), JSON.stringify({ width: WIDTH, height: HEIGHT, report }, null, 2));
  expect(report).toHaveLength(CASES.length);
});
