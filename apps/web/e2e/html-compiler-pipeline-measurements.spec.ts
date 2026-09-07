import { expect, test, type Page, type TestInfo } from "@playwright/test";

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Rgb = [number, number, number];

const BACKGROUND: Rgb = [8, 16, 24];
const COMPOSITION = { width: 1920, height: 1080 };

async function browserBox(page: Page, selector: string): Promise<Box | null> {
  const iframe = page.locator('[data-testid="html-compiler-browser-stage"] iframe');
  const iframeBox = await iframe.boundingBox();
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  const elementBox = frame ? await frame.locator(selector).boundingBox() : null;
  if (!iframeBox || !elementBox) return null;
  return {
    left: (elementBox.x - iframeBox.x) * COMPOSITION.width / iframeBox.width,
    top: (elementBox.y - iframeBox.y) * COMPOSITION.height / iframeBox.height,
    right: (elementBox.x + elementBox.width - iframeBox.x) * COMPOSITION.width / iframeBox.width,
    bottom: (elementBox.y + elementBox.height - iframeBox.y) * COMPOSITION.height / iframeBox.height,
    width: elementBox.width * COMPOSITION.width / iframeBox.width,
    height: elementBox.height * COMPOSITION.height / iframeBox.height,
  };
}

async function canvasMeasurements(page: Page, color: Rgb) {
  const canvas = page.getByTestId("html-compiler-runtime-canvas");
  return canvas.evaluate((_element, { color: target, background }) => {
    const element = document.querySelector<HTMLCanvasElement>('[data-testid="html-compiler-runtime-canvas"]');
    if (!element) throw new Error("Runtime canvas is missing");
    const context = element.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Runtime canvas readback is unavailable");
    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    const close = (offset: number, rgb: readonly number[], tolerance: number) =>
      Math.abs(pixels[offset]! - rgb[0]!) <= tolerance &&
      Math.abs(pixels[offset + 1]! - rgb[1]!) <= tolerance &&
      Math.abs(pixels[offset + 2]! - rgb[2]!) <= tolerance &&
      pixels[offset + 3]! > 0;
    let exact = 0;
    let painted = 0;
    let soft = 0;
    let left = element.width;
    let top = element.height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < element.height; y += 1) {
      for (let x = 0; x < element.width; x += 1) {
        const offset = (y * element.width + x) * 4;
        if (close(offset, target, 12)) {
          exact += 1;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
        if (!close(offset, background, 2)) painted += 1;
        const targetDistance = Math.abs(pixels[offset]! - target[0]!) +
          Math.abs(pixels[offset + 1]! - target[1]!) +
          Math.abs(pixels[offset + 2]! - target[2]!);
        const backgroundDistance = Math.abs(pixels[offset]! - background[0]!) +
          Math.abs(pixels[offset + 1]! - background[1]!) +
          Math.abs(pixels[offset + 2]! - background[2]!);
        if (backgroundDistance > 8 && targetDistance > 12 && pixels[offset + 3]! > 0) soft += 1;
      }
    }
    return {
      width: element.width,
      height: element.height,
      exact,
      painted,
      soft,
      bounds: right < 0 ? null : { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 },
      diagnostics: element.getAttribute("data-diagnostics"),
      drawCalls: Number(element.getAttribute("data-draw-calls") ?? 0),
    };
  }, { color, background: BACKGROUND });
}

async function openCase(page: Page, id: string): Promise<void> {
  await page.goto(`/docs/preview/html-compiler?case=${id}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("html-compiler-runtime-canvas")).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
  await expect(page.getByTestId("html-compiler-browser-stage")).toBeVisible();
  await expect(page.getByTestId("html-compiler-runtime-stage")).toBeVisible();
}

async function attachMeasurement(testInfo: TestInfo, value: unknown): Promise<void> {
  await testInfo.attach("pipeline-measurement.json", {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json",
  });
}

function expectClose(actual: Box, expected: Box, tolerance = 12): void {
  expect(Math.abs(actual.left - expected.left)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.top - expected.top)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.right - expected.right)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.bottom - expected.bottom)).toBeLessThanOrEqual(tolerance);
}

test.describe("HTML compiler pipeline measurements", () => {
  test("1. perspective without filter isolates projected geometry", async ({ page }, testInfo) => {
    await openCase(page, "html-compiler.perspective.group-translate-z");
    const expected = await browserBox(page, "#perspective-card");
    const actual = await canvasMeasurements(page, [34, 211, 238]);
    await attachMeasurement(testInfo, { pipeline: "perspective", expected, actual });
    expect(expected).not.toBeNull();
    expect(actual.diagnostics).not.toMatch(/unsupported|fallback/);
    expect(actual.drawCalls).toBeGreaterThan(0);
    expect(actual.bounds).not.toBeNull();
    expectClose(actual.bounds!, expected!);
  });

  test("2. blur without perspective isolates the filter surface", async ({ page }, testInfo) => {
    await openCase(page, "html-compiler.paint.filter-blur");
    const expected = await browserBox(page, "#filter-blur");
    const actual = await canvasMeasurements(page, [56, 189, 248]);
    const protocol = await page.locator("pre").last().textContent();
    await attachMeasurement(testInfo, { pipeline: "blur", expected, actual });
    expect(protocol).toContain('"type": "blur"');
    expect(actual.diagnostics).not.toMatch(/effect_unsupported|fallback/);
    expect(actual.exact).toBeGreaterThan(100_000);
    expect(actual.soft).toBeGreaterThan(0);
    expect(actual.bounds).not.toBeNull();
    expectClose(actual.bounds!, expected!, 24);
  });

  test("3. perspective with solid opaque content keeps the source silhouette", async ({ page }, testInfo) => {
    await openCase(page, "html-compiler.perspective.near-far-clipping");
    const expected = await browserBox(page, "#clip-visible");
    const actual = await canvasMeasurements(page, [52, 211, 153]);
    const protocol = await page.locator("pre").last().textContent();
    await attachMeasurement(testInfo, { pipeline: "perspective-solid", expected, actual });
    expect(protocol).toContain('"near": 1');
    expect(actual.diagnostics).not.toMatch(/current_3d_unsupported|fallback/);
    expect(actual.drawCalls).toBeGreaterThan(0);
    expect(actual.bounds).not.toBeNull();
    expectClose(actual.bounds!, expected!, 24);
  });

  test("4. perspective plus blur plus near-plane keeps ordered surface semantics", async ({ page }, testInfo) => {
    await openCase(page, "html-compiler.perspective.filter-blur-near-plane");
    const expected = await browserBox(page, "#p9-blur-card");
    const actual = await canvasMeasurements(page, [52, 211, 153]);
    const protocol = await page.locator("pre").last().textContent();
    await attachMeasurement(testInfo, { pipeline: "perspective-blur-near-plane", expected, actual });
    expect(protocol).toContain('"type": "blur"');
    expect(protocol).toContain('"near": 1');
    expect(actual.diagnostics).not.toMatch(/effect_unsupported|mask_surface|fallback/);
    expect(actual.drawCalls).toBeGreaterThan(0);
    expect(actual.painted).toBeGreaterThan(1_000);
    expect(actual.soft).toBeGreaterThan(0);
    expect(actual.bounds).not.toBeNull();
  });
});
