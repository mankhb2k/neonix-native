import { expect, test, type Page } from "@playwright/test";
import {
  analyzePresentedCanvas,
  readPresentedPixel,
  readWebGLPixel,
} from "./helpers/preview-pixels";

async function supportsWebGPU(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const gpu = (navigator as Navigator & {
      gpu?: {
        requestAdapter?: (options?: { powerPreference?: string }) => Promise<{
          requestDevice?: () => Promise<unknown>;
        } | null>;
      };
    }).gpu;
    const adapter = await gpu?.requestAdapter?.({ powerPreference: "high-performance" });
    if (!adapter?.requestDevice) return false;
    try {
      await adapter.requestDevice();
      return true;
    } catch {
      return false;
    }
  });
}

test.describe("Protocol V2 atom preview", () => {
  test("renders the certified rectangle fill through WebGL2 fallback", async ({
    page,
  }) => {
    await page.goto("/docs/preview?case=primitive.shape.rectangle&backend=webgl2");

    const canvas = page.getByTestId("preview-v2-canvas");
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");

    const fill = await readWebGLPixel(page, "preview-v2-canvas", 48, 32);
    const fillAtBounds = await readWebGLPixel(
      page,
      "preview-v2-canvas",
      95,
      63,
    );
    const background = await readWebGLPixel(page, "preview-v2-canvas", 200, 100);
    const outsideBounds = await readWebGLPixel(
      page,
      "preview-v2-canvas",
      96,
      64,
    );

    expect(fill).toEqual([0, 170, 136, 255]);
    expect(fillAtBounds).toEqual([0, 170, 136, 255]);
    expect(background).toEqual([16, 24, 32, 255]);
    expect(outsideBounds).toEqual([16, 24, 32, 255]);
  });

  test("renders ellipse center, bounding corners, and antialiased edge", async ({
    page,
  }) => {
    await page.goto("/docs/preview?case=primitive.shape.ellipse&backend=webgl2");
    const canvas = page.getByTestId("preview-v2-canvas");
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");

    const center = await readWebGLPixel(page, "preview-v2-canvas", 112, 72);
    const corner = await readWebGLPixel(page, "preview-v2-canvas", 48, 32);
    const edge = await readWebGLPixel(page, "preview-v2-canvas", 112, 32);

    expect(center).toEqual([0, 170, 136, 255]);
    expect(corner).toEqual([16, 24, 32, 255]);
    expect(edge[0]).toBeGreaterThan(0);
    expect(edge[0]).toBeLessThan(16);
    expect(edge[1]).toBeGreaterThan(24);
    expect(edge[1]).toBeLessThan(170);
  });

  test("renders rectangle stroke in WebGL2 and WebGPU", async ({ page }) => {
    const caseId = "rectangle.paint.stroke";
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );

    const webglFill = await readWebGLPixel(page, "preview-v2-canvas", 960, 510);
    const webglStroke = await readWebGLPixel(page, "preview-v2-canvas", 960, 422);
    const webglOutside = await readWebGLPixel(page, "preview-v2-canvas", 960, 415);
    expect(webglFill).toEqual([0, 170, 136, 255]);
    expect(webglStroke[0]).toBeGreaterThan(webglFill[0]);
    expect(webglStroke[1]).toBeLessThan(webglFill[1]);
    expect(webglStroke[2]).toBeLessThan(webglFill[2]);
    expect(webglOutside).toEqual([16, 24, 32, 255]);

    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgpu",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-draw-calls",
      "1",
    );
    expect(await readPresentedPixel(page, "preview-v2-canvas", 960, 510)).toEqual([
      0,
      170,
      136,
      255,
    ]);
    const webgpuStroke = await readPresentedPixel(page, "preview-v2-canvas", 960, 422);
    expect(webgpuStroke[0]).toBeGreaterThan(0);
    expect(webgpuStroke[1]).toBeLessThan(170);
    expect(webgpuStroke[2]).toBeLessThan(136);
    expect(await readPresentedPixel(page, "preview-v2-canvas", 960, 415)).toEqual([
      16,
      24,
      32,
      255,
    ]);
  });

  test("keeps rectangle stroke paint through Matrix4 perspective", async ({ page }) => {
    await page.goto(
      "/docs/preview?case=rectangle.paint.stroke-perspective&backend=webgl2",
    );
    const webgl = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgl.bounds).not.toBeNull();
    expect(webgl.fillPixels).toBeGreaterThan(1000);

    await page.goto(
      "/docs/preview?case=rectangle.paint.stroke-perspective&backend=webgl2",
    );
    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(
      "/docs/preview?case=rectangle.paint.stroke-perspective&backend=webgpu",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgpu",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-draw-calls",
      "1",
    );
    const webgpu = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgpu.bounds).not.toBeNull();
    expect(webgpu.fillPixels).toBeGreaterThan(1000);
  });

  test("renders ellipse stroke in WebGL2 and WebGPU", async ({ page }) => {
    const caseId = "ellipse.paint.stroke";
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );

    const webglFill = await readWebGLPixel(page, "preview-v2-canvas", 960, 510);
    const webglStroke = await readWebGLPixel(page, "preview-v2-canvas", 960, 422);
    const webglOutside = await readWebGLPixel(page, "preview-v2-canvas", 800, 420);
    expect(webglFill).toEqual([0, 170, 136, 255]);
    expect(webglStroke[0]).toBeGreaterThan(webglFill[0]);
    expect(webglStroke[1]).toBeLessThan(webglFill[1]);
    expect(webglStroke[2]).toBeLessThan(webglFill[2]);
    expect(webglOutside).toEqual([16, 24, 32, 255]);

    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgpu",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-draw-calls",
      "1",
    );
    expect(await readPresentedPixel(page, "preview-v2-canvas", 960, 510)).toEqual([
      0,
      170,
      136,
      255,
    ]);
    const webgpuStroke = await readPresentedPixel(page, "preview-v2-canvas", 960, 422);
    expect(webgpuStroke[0]).toBeGreaterThan(0);
    expect(webgpuStroke[1]).toBeLessThan(170);
    expect(webgpuStroke[2]).toBeLessThan(136);
    expect(await readPresentedPixel(page, "preview-v2-canvas", 800, 420)).toEqual([
      16,
      24,
      32,
      255,
    ]);
  });

  test("keeps ellipse stroke paint through Matrix4 perspective", async ({ page }) => {
    await page.goto(
      "/docs/preview?case=ellipse.paint.stroke-perspective&backend=webgl2",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );
    const webgl = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgl.bounds).not.toBeNull();
    expect(webgl.fillPixels).toBeGreaterThan(1000);

    await page.goto(
      "/docs/preview?case=ellipse.paint.stroke-perspective&backend=webgl2",
    );
    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(
      "/docs/preview?case=ellipse.paint.stroke-perspective&backend=webgpu",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgpu",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-draw-calls",
      "1",
    );
    const webgpu = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgpu.bounds).not.toBeNull();
    expect(webgpu.fillPixels).toBeGreaterThan(1000);
  });

  test("preserves custom rectangle stroke width in both backends", async ({ page }) => {
    const caseId = "rectangle.paint.stroke-width";
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );
    const webglFill = await readWebGLPixel(page, "preview-v2-canvas", 960, 440);
    const webglStroke = await readWebGLPixel(page, "preview-v2-canvas", 960, 426);
    const webglOutside = await readWebGLPixel(page, "preview-v2-canvas", 960, 415);
    expect(webglFill).toEqual([0, 170, 136, 255]);
    expect(webglStroke).toEqual([255, 51, 102, 255]);
    expect(webglOutside).toEqual([16, 24, 32, 255]);

    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgpu",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-draw-calls",
      "1",
    );
    expect(await readPresentedPixel(page, "preview-v2-canvas", 960, 440)).toEqual([
      0,
      170,
      136,
      255,
    ]);
    expect(await readPresentedPixel(page, "preview-v2-canvas", 960, 426)).toEqual([
      255,
      51,
      102,
      255,
    ]);
    expect(await readPresentedPixel(page, "preview-v2-canvas", 960, 415)).toEqual([
      16,
      24,
      32,
      255,
    ]);
  });

  test("keeps custom stroke width attached to Matrix4 perspective", async ({ page }) => {
    await page.goto(
      "/docs/preview?case=rectangle.paint.stroke-width-perspective&backend=webgl2",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );
    const webgl = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgl.bounds).not.toBeNull();
    expect(webgl.fillPixels).toBeGreaterThan(1000);

    await page.goto(
      "/docs/preview?case=rectangle.paint.stroke-width-perspective&backend=webgl2",
    );
    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(
      "/docs/preview?case=rectangle.paint.stroke-width-perspective&backend=webgpu",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgpu",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-draw-calls",
      "1",
    );
    const webgpu = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgpu.bounds).not.toBeNull();
    expect(webgpu.fillPixels).toBeGreaterThan(1000);
  });

  test("composites independent fill and stroke opacity in both backends", async ({ page }) => {
    const caseId = "rectangle.paint.opacity";
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );
    const webglFill = await readWebGLPixel(page, "preview-v2-canvas", 960, 440);
    const webglStroke = await readWebGLPixel(page, "preview-v2-canvas", 960, 426);
    expect(webglFill).toEqual([8, 97, 84, 255]);
    expect(webglStroke).toEqual([76, 31, 50, 255]);

    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgpu",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-draw-calls",
      "1",
    );
    expect(await readPresentedPixel(page, "preview-v2-canvas", 960, 440)).toEqual([
      8,
      97,
      84,
      255,
    ]);
    expect(await readPresentedPixel(page, "preview-v2-canvas", 960, 426)).toEqual([
      76,
      31,
      50,
      255,
    ]);
  });

  test("keeps independent paint opacity through Matrix4 perspective", async ({ page }) => {
    await page.goto(
      "/docs/preview?case=rectangle.paint.opacity-perspective&backend=webgl2",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );
    const webgl = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgl.bounds).not.toBeNull();
    expect(webgl.fillPixels).toBeGreaterThan(1000);

    await page.goto(
      "/docs/preview?case=rectangle.paint.opacity-perspective&backend=webgl2",
    );
    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(
      "/docs/preview?case=rectangle.paint.opacity-perspective&backend=webgpu",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgpu",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-draw-calls",
      "1",
    );
    const webgpu = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgpu.bounds).not.toBeNull();
    expect(webgpu.fillPixels).toBeGreaterThan(1000);
  });

  test("defaults to WebGPU and falls back to WebGL2", async ({ page }) => {
    await page.goto("/docs/preview?case=primitive.shape.rectangle");
    const expectedBackend = await page.evaluate(async () => {
      const gpu = (navigator as Navigator & {
        gpu?: {
          requestAdapter?: () => Promise<{
            requestDevice?: () => Promise<unknown>;
          } | null>;
        };
      }).gpu;
      if (!gpu?.requestAdapter) return "webgl2";
      try {
        const adapter = await gpu.requestAdapter();
        if (!adapter?.requestDevice) return "webgl2";
        await adapter.requestDevice();
        return "webgpu";
      } catch {
        return "webgl2";
      }
    });

    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      expectedBackend,
    );
    await expect(page.getByTestId("preview-active-backend")).toHaveText(
      expectedBackend === "webgpu" ? "Active: WebGPU" : "Active: WebGL2",
    );
  });

  test("toggles forced WebGPU and WebGL2 preview backends", async ({ page }) => {
    await page.goto("/docs/preview?case=primitive.shape.rectangle");
    const supportsWebGPU = await page.evaluate(async () => {
      const gpu = (navigator as Navigator & {
        gpu?: { requestAdapter?: () => Promise<unknown | null> };
      }).gpu;
      const adapter = await gpu?.requestAdapter?.();
      return Boolean(adapter);
    });

    await page.getByTestId("preview-backend-webgl2").click();
    await expect(page).toHaveURL(/backend=webgl2/);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );
    await expect(page.getByTestId("preview-active-backend")).toHaveText(
      "Active: WebGL2",
    );

    await page.getByTestId("preview-backend-webgpu").click();
    await expect(page).toHaveURL(/backend=webgpu/);
    if (supportsWebGPU) {
      await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
        "data-backend",
        "webgpu",
      );
      await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
        "data-draw-calls",
        "1",
      );
      await expect(page.getByTestId("preview-active-backend")).toHaveText(
        "Active: WebGPU",
      );
    } else {
      await expect(page.getByTestId("preview-v2-error")).toBeVisible();
    }
  });

  test("renders the perspective Matrix4 rectangle through WebGPU when available", async ({
    page,
  }) => {
    await page.goto(
      "/docs/preview?case=rectangle.mat4.anchor-z-rotate-y-perspective&backend=webgl2",
    );
    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");

    await page.goto(
      "/docs/preview?case=rectangle.mat4.anchor-z-rotate-y-perspective&backend=webgpu",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgpu",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-draw-calls",
      "1",
    );
    await expect(page.getByTestId("preview-v2-error")).toHaveCount(0);
  });

  test("renders each certified rectangle Task 3 property", async ({ page }) => {
    async function pixel(caseId: string, x: number, y: number, time?: number) {
      const params = new URLSearchParams({ case: caseId, backend: "webgl2" });
      if (time !== undefined) params.set("time", String(time));
      await page.goto(`/docs/preview?${params}`);
      await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
        "data-backend",
        "webgl2",
      );
      return readWebGLPixel(page, "preview-v2-canvas", x, y);
    }

    await expect(pixel("rectangle.transform.translate", 96, 64)).resolves.toEqual(
      [0, 170, 136, 255],
    );
    await expect(pixel("rectangle.transform.translate", 20, 20)).resolves.toEqual(
      [16, 24, 32, 255],
    );

    await expect(pixel("rectangle.transform.scale", 150, 100)).resolves.toEqual(
      [0, 170, 136, 255],
    );
    await expect(pixel("rectangle.transform.scale", 161, 100)).resolves.toEqual(
      [16, 24, 32, 255],
    );

    await expect(pixel("rectangle.transform.anchor", 150, 100)).resolves.toEqual(
      [0, 170, 136, 255],
    );
    await expect(pixel("rectangle.transform.anchor", 120, 70)).resolves.toEqual(
      [16, 24, 32, 255],
    );

    await expect(pixel("rectangle.transform.rotate", 200, 110)).resolves.toEqual(
      [0, 170, 136, 255],
    );
    await expect(pixel("rectangle.transform.rotate", 170, 110)).resolves.toEqual(
      [16, 24, 32, 255],
    );

    const outsideAnchor = await pixel(
      "rectangle.mat4.anchor-outside-rotate-z",
      500,
      250,
    );
    expect(outsideAnchor).toEqual([0, 170, 136, 255]);

    const perspective = await pixel(
      "rectangle.mat4.anchor-z-rotate-y-perspective",
      960,
      540,
    );
    expect(perspective).toEqual([0, 170, 136, 255]);

    await expect(pixel("rectangle.transform.skew", 100, 70)).resolves.toEqual(
      [0, 170, 136, 255],
    );
    await expect(pixel("rectangle.transform.skew", 45, 85)).resolves.toEqual(
      [16, 24, 32, 255],
    );

    await expect(pixel("rectangle.timing", 50, 35, 0.999)).resolves.toEqual([
      16, 24, 32, 255,
    ]);
    await expect(pixel("rectangle.timing", 50, 35, 1)).resolves.toEqual([
      0, 170, 136, 255,
    ]);
    await expect(pixel("rectangle.timing", 50, 35, 2)).resolves.toEqual([
      16, 24, 32, 255,
    ]);

    await expect(pixel("rectangle.opacity", 50, 35)).resolves.toEqual([
      8, 97, 84, 255,
    ]);
    await expect(pixel("rectangle.z-index", 960, 540)).resolves.toEqual([
      255, 51, 102, 255,
    ]);
    await expect(pixel("rectangle.z-index", 400, 250)).resolves.toEqual([
      0, 170, 136, 255,
    ]);
  });

  test("fits a full HD composition inside the stage and exposes transport controls", async ({
    page,
  }) => {
    await page.goto("/docs/preview?case=primitive.shape.rectangle&backend=webgl2");
    const canvas = page.getByTestId("preview-v2-canvas");
    const stage = page.getByTestId("preview-v2-stage");
    await expect(canvas).toHaveJSProperty("width", 1920);
    await expect(canvas).toHaveJSProperty("height", 1080);
    await expect(canvas).toHaveAttribute("data-device-pixel-ratio", "1");
    await expect(canvas).toHaveAttribute("data-backing-width", "1920");
    await expect(canvas).toHaveAttribute("data-backing-height", "1080");
    await expect(stage).toBeVisible();
    await expect(page.getByTestId("preview-transport")).toBeVisible();
    await expect(page.getByTestId("preview-timecode")).toHaveText("0:00 / 0:03");

    await page.getByTestId("preview-play-toggle").click();
    await expect(page.getByTestId("preview-play-toggle")).toHaveAttribute(
      "aria-label",
      "Pause",
    );
    await page.getByTestId("preview-play-toggle").click();
    await expect(page.getByTestId("preview-play-toggle")).toHaveAttribute(
      "aria-label",
      "Play",
    );
  });

  test("keeps 3D rectangle bounds and interior pixels within backend tolerance", async ({
    page,
  }) => {
    const cases = [
      "rectangle.mat4.rotate-x-perspective",
      "rectangle.mat4.rotate-y-perspective",
      "rectangle.mat4.anchor-z-rotate-y-perspective",
      "rectangle.mat4.translate-z-perspective",
    ];
    const webglResults = new Map<string, Awaited<ReturnType<typeof analyzePresentedCanvas>>>();
    for (const caseId of cases) {
      await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
      await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
        "data-backend",
        "webgl2",
      );
      webglResults.set(
        caseId,
        await analyzePresentedCanvas(page, "preview-v2-canvas"),
      );
    }

    await page.goto(
      "/docs/preview?case=rectangle.mat4.rotate-x-perspective&backend=webgl2",
    );
    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");

    for (const caseId of cases) {
      await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
      await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
        "data-backend",
        "webgpu",
      );
      const webgpu = await analyzePresentedCanvas(page, "preview-v2-canvas");
      const webgl = webglResults.get(caseId)!;
      expect(webgpu.width).toBe(webgl.width);
      expect(webgpu.height).toBe(webgl.height);
      expect(webgpu.center).toEqual([0, 170, 136, 255]);
      expect(webgl.center).toEqual([0, 170, 136, 255]);
      expect(webgpu.bounds).not.toBeNull();
      expect(webgl.bounds).not.toBeNull();
      expect(Math.abs(webgpu.bounds!.left - webgl.bounds!.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(webgpu.bounds!.top - webgl.bounds!.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(webgpu.bounds!.right - webgl.bounds!.right)).toBeLessThanOrEqual(1);
      expect(Math.abs(webgpu.bounds!.bottom - webgl.bounds!.bottom)).toBeLessThanOrEqual(1);
      expect(webgpu.partialCoveragePixels).toBeGreaterThan(0);
      expect(webgl.partialCoveragePixels).toBeGreaterThan(0);
      expect(webgpu.darkFringePixels).toBe(0);
      expect(webgl.darkFringePixels).toBe(0);
    }
  });

  test("reports WebGL2 antialias capability at the native canvas resolution", async ({
    page,
  }) => {
    await page.goto("/docs/preview?case=rectangle.mat4.rotate-x-perspective&backend=webgl2");
    const info = await page.getByTestId("preview-v2-canvas").evaluate((node) => {
      if (!(node instanceof HTMLCanvasElement)) throw new Error("Expected canvas");
      const gl = node.getContext("webgl2");
      if (!gl) throw new Error("WebGL2 context is not available");
      return {
        antialias: gl.getContextAttributes()?.antialias ?? false,
        samples: gl.getParameter(gl.SAMPLES) as number,
        width: node.width,
        height: node.height,
      };
    });
    expect(info.antialias).toBe(true);
    expect(info.samples).toBeGreaterThanOrEqual(0);
    expect(info.width).toBe(1920);
    expect(info.height).toBe(1080);
  });
});

test.describe("Task 4.5 physical canvas", () => {
  test.use({ deviceScaleFactor: 2 });

  test("keeps logical composition dimensions while backing the canvas at DPR 2", async ({
    page,
  }) => {
    await page.goto("/docs/preview?case=rectangle.mat4.rotate-y-perspective&backend=webgl2");
    const canvas = page.getByTestId("preview-v2-canvas");
    await expect(canvas).toHaveJSProperty("width", 3840);
    await expect(canvas).toHaveJSProperty("height", 2160);
    await expect(canvas).toHaveAttribute("data-device-pixel-ratio", "2");
    await expect(canvas).toHaveAttribute("data-logical-width", "1920");
    await expect(canvas).toHaveAttribute("data-logical-height", "1080");
    await expect(canvas).toHaveAttribute("data-backing-width", "3840");
    await expect(canvas).toHaveAttribute("data-backing-height", "2160");
    await expect(canvas).toHaveAttribute("data-css-scale", /\d/);
    await expect(canvas).toHaveAttribute("data-device-pixel-ratio", "2");
    await expect(canvas).toHaveAttribute("data-backing-width", "3840");
    await expect(canvas).toHaveAttribute("data-backing-height", "2160");
  });
});
