import { expect, test } from "@playwright/test";
import { SKIA_PREVIEW_CASES } from "../lib/docs/skia-preview-fixtures";
import { readSkiaDiff } from "./skia-pixel-diff";

test.describe("Skia Phase 8 SVG reference contract", () => {
  test("keeps SVG and Skia on the same frame, viewport, and pixel surface", async ({ page }) => {
    const fixture = SKIA_PREVIEW_CASES[0];
    if (!fixture) throw new Error("Skia path fixtures are empty");

    await page.goto("/docs/preview/skia");
    const select = page.locator("#runtime-skia-case");
    const canvas = page.getByTestId("skia-runtime-stage");
    await select.selectOption(fixture.id);
    await expect(canvas).toHaveAttribute("data-backend", "skia", { timeout: 30_000 });
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });

    const contract = await page.evaluate(() => {
      const iframe = document.querySelector("iframe[data-testid='skia-svg-reference']");
      const canvas = document.querySelector("canvas[data-testid='skia-runtime-stage']");
      if (!(iframe instanceof HTMLIFrameElement) || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error("Skia SVG/canvas reference contract is not ready");
      }
      const svg = iframe.contentDocument?.querySelector("svg");
      if (!svg) throw new Error("Skia SVG reference is not ready");
      return {
        svgWidth: Number(svg.getAttribute("width")),
        svgHeight: Number(svg.getAttribute("height")),
        viewBox: svg.getAttribute("viewBox"),
        canvasWidth: Number(canvas.dataset.logicalWidth),
        canvasHeight: Number(canvas.dataset.logicalHeight),
        backingWidth: canvas.width,
        backingHeight: canvas.height,
        svgFrame: Number(svg.getAttribute("data-runtime-frame")),
        svgTime: Number(svg.getAttribute("data-runtime-time")),
        canvasFrame: Number(canvas.dataset.runtimeFrame),
        canvasTime: Number(canvas.dataset.runtimeTime),
        fixture: svg.getAttribute("data-fixture"),
      };
    });

    expect(contract.fixture).toBe(fixture.id);
    expect(contract.svgWidth).toBe(contract.canvasWidth);
    expect(contract.svgHeight).toBe(contract.canvasHeight);
    expect(contract.viewBox).toBe(`0 0 ${contract.canvasWidth} ${contract.canvasHeight}`);
    expect(contract.svgFrame).toBe(contract.canvasFrame);
    expect(contract.svgTime).toBeCloseTo(contract.canvasTime, 6);

    const diff = await readSkiaDiff(page);
    expect(diff.width).toBe(contract.backingWidth);
    expect(diff.height).toBe(contract.backingHeight);
    expect(diff.paintedPixels).toBeGreaterThan(0);
    expect(diff.changedRatio).toBeLessThan(0.02);
    expect(diff.meanAbsoluteDelta).toBeLessThan(2.5);
  });

  test("preserves ordered color-adjust and blur effects", async ({ page }) => {
    await page.goto("/docs/preview/skia");
    const select = page.locator("#runtime-skia-case");
    const canvas = page.getByTestId("skia-runtime-stage");
    await select.selectOption("effect.order");
    await expect(canvas).toHaveAttribute("data-backend", "skia", { timeout: 30_000 });
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_effect_unsupported|skia_command_unsupported/);

    const result = await page.evaluate(() => {
      const iframe = document.querySelector("iframe[data-testid='skia-svg-reference']");
      const canvas = document.querySelector("canvas[data-testid='skia-runtime-stage']");
      if (!(iframe instanceof HTMLIFrameElement) || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error("Skia effect-order surfaces are missing");
      }
      const svg = iframe.contentDocument?.querySelector("svg");
      const context = canvas.getContext("2d");
      if (!svg || !context) throw new Error("Skia effect-order surfaces are not ready");
      const sample = (x: number) => {
        const nativeX = Math.max(0, Math.min(canvas.width - 1, Math.round(x * canvas.width / 1920)));
        const nativeY = Math.max(0, Math.min(canvas.height - 1, Math.round(540 * canvas.height / 1080)));
        return Array.from(context.getImageData(nativeX, nativeY, 1, 1).data);
      };
      return {
        left: sample(500),
        right: sample(1460),
        svgFilters: svg.querySelectorAll("filter").length,
      };
    });

    expect(result.svgFilters).toBeGreaterThanOrEqual(2);
    expect(result.left[0]).toBeGreaterThan(20);
    expect(result.right[0]).toBeGreaterThan(20);
    expect(result.left).not.toEqual([0, 0, 0, 255]);
    expect(result.right).not.toEqual([0, 0, 0, 255]);
    const diff = await readSkiaDiff(page);
    expect(diff.changedRatio).toBeLessThan(0.12);
    expect(diff.meanAbsoluteDelta).toBeLessThan(15);
  });

  test("renders deterministic noise in the Skia layer", async ({ page }) => {
    await page.goto("/docs/preview/skia");
    const select = page.locator("#runtime-skia-case");
    const canvas = page.getByTestId("skia-runtime-stage");
    await select.selectOption("effect.noise");
    await expect(canvas).toHaveAttribute("data-backend", "skia", { timeout: 30_000 });
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /skia_effect_unsupported|skia_command_unsupported/);
    const range = await page.evaluate(() => {
      const canvas = document.querySelector("canvas[data-testid='skia-runtime-stage']");
      if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Skia noise canvas is not ready");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Skia noise context is not ready");
      const pixels = context.getImageData(Math.floor(canvas.width * 0.62), Math.floor(canvas.height * 0.28), Math.floor(canvas.width * 0.2), Math.floor(canvas.height * 0.45)).data;
      let min = 255;
      let max = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        min = Math.min(min, pixels[index]!);
        max = Math.max(max, pixels[index]!);
      }
      return { min, max };
    });
    expect(range.max - range.min).toBeGreaterThan(20);
  });
});
