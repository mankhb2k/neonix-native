import type { Page } from "@playwright/test";

export type RgbaPixel = [number, number, number, number];

export type CanvasAnalysis = {
  width: number;
  height: number;
  center: RgbaPixel;
  bounds: { left: number; top: number; right: number; bottom: number } | null;
  fillPixels: number;
  partialCoveragePixels: number;
  darkFringePixels: number;
};

export async function readWebGLPixel(
  page: Page,
  testId: string,
  x: number,
  y: number,
): Promise<RgbaPixel> {
  return page.getByTestId(testId).evaluate(
    (node, point) => {
      if (!(node instanceof HTMLCanvasElement)) {
        throw new Error(`Expected ${point.testId} to be a canvas`);
      }
      const gl = node.getContext("webgl2");
      if (!gl) throw new Error("WebGL2 context is not available");
      const logicalWidth = Number(node.dataset.logicalWidth) || node.width;
      const logicalHeight = Number(node.dataset.logicalHeight) || node.height;
      const nativeX = Math.max(0, Math.min(node.width - 1, Math.round(point.x * node.width / logicalWidth)));
      const nativeY = Math.max(0, Math.min(node.height - 1, Math.round(point.y * node.height / logicalHeight)));
      const pixel = new Uint8Array(4);
      gl.readPixels(
        nativeX,
        node.height - nativeY - 1,
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixel,
      );
      return [pixel[0]!, pixel[1]!, pixel[2]!, pixel[3]!] as RgbaPixel;
    },
    { testId, x, y },
  );
}

export async function readPresentedPixel(
  page: Page,
  testId: string,
  x: number,
  y: number,
): Promise<RgbaPixel> {
  return page.getByTestId(testId).evaluate(
    async (node, point) => {
      if (!(node instanceof HTMLCanvasElement)) {
        throw new Error(`Expected ${point.testId} to be a canvas`);
      }
      const logicalWidth = Number(node.dataset.logicalWidth) || node.width;
      const logicalHeight = Number(node.dataset.logicalHeight) || node.height;
      const nativeX = Math.max(0, Math.min(node.width - 1, Math.round(point.x * node.width / logicalWidth)));
      const nativeY = Math.max(0, Math.min(node.height - 1, Math.round(point.y * node.height / logicalHeight)));
      const image = new Image();
      image.src = node.toDataURL("image/png");
      await image.decode();
      const capture = document.createElement("canvas");
      capture.width = node.width;
      capture.height = node.height;
      const context = capture.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("2D readback context is not available");
      context.drawImage(image, 0, 0);
      const pixel = context.getImageData(nativeX, nativeY, 1, 1).data;
      return [pixel[0]!, pixel[1]!, pixel[2]!, pixel[3]!] as RgbaPixel;
    },
    { testId, x, y },
  );
}

/**
 * Reads the presented canvas through PNG readback so the same assertion works
 * for WebGL2 and WebGPU. Coordinates are top-left, like ImageData and the
 * composition JSON, rather than WebGL's bottom-left convention.
 */
export async function analyzePresentedCanvas(
  page: Page,
  testId: string,
): Promise<CanvasAnalysis> {
  return page.getByTestId(testId).evaluate(async (node, expectedTestId) => {
    if (!(node instanceof HTMLCanvasElement)) {
      throw new Error(`Expected ${expectedTestId} to be a canvas`);
    }
    const image = new Image();
    image.src = node.toDataURL("image/png");
    await image.decode();
    const capture = document.createElement("canvas");
    capture.width = node.width;
    capture.height = node.height;
    const context = capture.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("2D readback context is not available");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, capture.width, capture.height);
    const isFill = (offset: number) =>
      pixels.data[offset]! < 32 &&
      pixels.data[offset + 1]! > 70 &&
      pixels.data[offset + 2]! > 50;
    const isPartialCoverage = (offset: number) =>
      pixels.data[offset]! < 32 &&
      pixels.data[offset + 1]! > 24 &&
      pixels.data[offset + 1]! < 170 &&
      pixels.data[offset + 2]! > 32 &&
      pixels.data[offset + 2]! < 136;
    let left = capture.width;
    let top = capture.height;
    let right = -1;
    let bottom = -1;
    let fillPixels = 0;
    let partialCoveragePixels = 0;
    let darkFringePixels = 0;
    for (let y = 0; y < capture.height; y += 1) {
      for (let x = 0; x < capture.width; x += 1) {
        const offset = (y * capture.width + x) * 4;
        if (isFill(offset)) {
          fillPixels += 1;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        } else if (isPartialCoverage(offset)) {
          partialCoveragePixels += 1;
        }
        if (
          pixels.data[offset]! < 15 &&
          pixels.data[offset + 1]! < 23 &&
          pixels.data[offset + 2]! < 31
        ) {
          darkFringePixels += 1;
        }
      }
    }
    const centerOffset =
      (Math.floor(capture.height / 2) * capture.width +
        Math.floor(capture.width / 2)) *
      4;
    return {
      width: capture.width,
      height: capture.height,
      center: [
        pixels.data[centerOffset]!,
        pixels.data[centerOffset + 1]!,
        pixels.data[centerOffset + 2]!,
        pixels.data[centerOffset + 3]!,
      ] as RgbaPixel,
      bounds:
        right >= 0
          ? { left, top, right, bottom }
          : null,
      fillPixels,
      partialCoveragePixels,
      darkFringePixels,
    } satisfies CanvasAnalysis;
  }, testId);
}
