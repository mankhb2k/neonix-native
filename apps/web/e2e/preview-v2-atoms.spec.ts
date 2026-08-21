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
  test("applies the V2 color-adjust effect in matching GPU backends", async ({ page }) => {
    const caseId = "effect.color-adjust";
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute("data-backend", "webgl2");
    const source = await readWebGLPixel(page, "preview-v2-canvas", 480, 540);
    const adjusted = await readWebGLPixel(page, "preview-v2-canvas", 1440, 540);
    expect(source).toEqual([255, 0, 0, 255]);
    expect(adjusted[0]).toBeGreaterThan(50);
    expect(adjusted[0]).toBeLessThan(60);
    expect(Math.abs(adjusted[0] - adjusted[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(adjusted[1] - adjusted[2])).toBeLessThanOrEqual(1);

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute("data-backend", "webgpu");
    const webgpu = await readPresentedPixel(page, "preview-v2-canvas", 1440, 540);
    for (let index = 0; index < 4; index += 1) {
      expect(Math.abs(webgpu[index]! - adjusted[index]!)).toBeLessThanOrEqual(1);
    }
  });

  test("renders Runtime-shaped exact-font text through both GPU backends", async ({ page }) => {
    const caseId = "text.single-line.alignment";
    const textPixels = async () => page.getByTestId("preview-v2-canvas").evaluate(async (node) => {
      if (!(node instanceof HTMLCanvasElement)) throw new Error("Expected preview canvas");
      const image = new Image();
      image.src = node.toDataURL("image/png");
      await image.decode();
      const capture = document.createElement("canvas");
      capture.width = node.width;
      capture.height = node.height;
      const context = capture.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Missing readback context");
      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, capture.width, capture.height).data;
      let count = 0;
      let left = capture.width;
      let top = capture.height;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < capture.height; y += 1) {
        for (let x = 0; x < capture.width; x += 1) {
          const offset = (y * capture.width + x) * 4;
          if (data[offset]! > 210 && data[offset + 1]! > 210 && data[offset + 2]! > 210) {
            count += 1;
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
          }
        }
      }
      return { count, left, top, right, bottom };
    });

    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    const canvas = page.getByTestId("preview-v2-canvas");
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /text_|font_/);
    await expect.poll(async () => Number(await canvas.getAttribute("data-draw-calls"))).toBeGreaterThan(10);
    const webgl = await textPixels();
    expect(webgl.count).toBeGreaterThan(1_000);

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /text_|font_/);
    await expect.poll(async () => Number(await canvas.getAttribute("data-draw-calls"))).toBeGreaterThan(10);
    const webgpu = await textPixels();
    expect(webgpu.count).toBeGreaterThan(1_000);
    expect(Math.abs(webgpu.left - webgl.left)).toBeLessThanOrEqual(2);
    expect(Math.abs(webgpu.top - webgl.top)).toBeLessThanOrEqual(2);
    expect(Math.abs(webgpu.right - webgl.right)).toBeLessThanOrEqual(2);
    expect(Math.abs(webgpu.bottom - webgl.bottom)).toBeLessThanOrEqual(2);
  });

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

  test("renders a Runtime-tessellated path through the shared Matrix4 projection", async ({ page }) => {
    const caseId = "path.closed-fill.perspective";
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );
    const webgl = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgl.bounds).not.toBeNull();
    expect(webgl.fillPixels).toBeGreaterThan(5_000);

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
    const webgpu = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgpu.bounds).not.toBeNull();
    expect(webgpu.fillPixels).toBeGreaterThan(5_000);
    expect(Math.abs(webgpu.bounds!.left - webgl.bounds!.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(webgpu.bounds!.top - webgl.bounds!.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(webgpu.bounds!.right - webgl.bounds!.right)).toBeLessThanOrEqual(1);
    expect(Math.abs(webgpu.bounds!.bottom - webgl.bounds!.bottom)).toBeLessThanOrEqual(1);
  });

  test("makes behind-camera clipping visible with reference layers", async ({ page }) => {
    await page.goto("/docs/preview?case=matrix4.camera-plane&backend=webgl2");
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );
    expect(await readWebGLPixel(page, "preview-v2-canvas", 50, 50)).toEqual([
      255,
      51,
      102,
      255,
    ]);
    expect(await readWebGLPixel(page, "preview-v2-canvas", 960, 510)).toEqual([
      0,
      170,
      136,
      255,
    ]);
    expect(await readWebGLPixel(page, "preview-v2-canvas", 400, 250)).toEqual([
      16,
      24,
      32,
      255,
    ]);
  });

  test("renders the five-point and six-point fill-rule path examples", async ({ page }) => {
    const caseIds = ["path.fill-rule.nonzero", "path.fill-rule.evenodd"];
    for (const caseId of caseIds) {
      await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
      await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
        "data-backend",
        "webgl2",
      );
      const pixels = await analyzePresentedCanvas(page, "preview-v2-canvas");
      expect(pixels.bounds).not.toBeNull();
      expect(pixels.fillPixels).toBeGreaterThan(10_000);
    }

    await page.goto("/docs/preview?case=path.fill-rule.nonzero&backend=webgl2");
    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    for (const caseId of caseIds) {
      await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
      await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
        "data-backend",
        "webgpu",
      );
      await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
        "data-draw-calls",
        "1",
      );
      const pixels = await analyzePresentedCanvas(page, "preview-v2-canvas");
      expect(pixels.bounds).not.toBeNull();
      expect(pixels.fillPixels).toBeGreaterThan(10_000);
    }
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

  test("renders a stroked path in WebGL2 and WebGPU", async ({ page }) => {
    const caseId = "path.paint.stroke";
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );
    const webgl = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgl.bounds).not.toBeNull();
    expect(webgl.fillPixels).toBeGreaterThan(10_000);

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgpu",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-draw-calls",
      "2",
    );
    const webgpu = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgpu.bounds).not.toBeNull();
    expect(webgpu.fillPixels).toBeGreaterThan(10_000);
  });

  test("renders open path caps and dashes", async ({ page }) => {
    const caseId = "path.paint.stroke-cap-dash";
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );
    const webgl = await readPresentedPixel(page, "preview-v2-canvas", 500, 520);
    expect(webgl[0]).toBeGreaterThan(200);
    expect(webgl[1]).toBeLessThan(100);

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
    const webgpu = await readPresentedPixel(page, "preview-v2-canvas", 500, 520);
    expect(webgpu[0]).toBeGreaterThan(200);
    expect(webgpu[1]).toBeLessThan(100);
  });

  test("renders a topology-matched path morph", async ({ page }) => {
    const caseId = "path.morph";
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );
    const webgl = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgl.bounds).not.toBeNull();
    expect(webgl.fillPixels).toBeGreaterThan(5_000);

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgpu",
    );
    const webgpu = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgpu.bounds).not.toBeNull();
    expect(webgpu.fillPixels).toBeGreaterThan(5_000);
  });

  test("renders Group parent transforms as two ordered leaf draws", async ({ page }) => {
    const caseId = "group.parent-transform";
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );
    const webgl = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgl.bounds).not.toBeNull();
    expect(webgl.fillPixels).toBeGreaterThan(5_000);

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgpu",
    );
    // The Group is hierarchy-only. Only its two shape children reach the GPU.
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-draw-calls",
      "2",
    );
    const webgpu = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgpu.bounds).not.toBeNull();
    expect(webgpu.fillPixels).toBeGreaterThan(5_000);
    expect(Math.abs(webgpu.bounds!.left - webgl.bounds!.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(webgpu.bounds!.top - webgl.bounds!.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(webgpu.bounds!.right - webgl.bounds!.right)).toBeLessThanOrEqual(1);
    expect(Math.abs(webgpu.bounds!.bottom - webgl.bounds!.bottom)).toBeLessThanOrEqual(1);
  });

  test("renders Image Atom contain, cover, and crop through both backends", async ({ page }) => {
    const cases = [
      { id: "image.fit.contain", center: [960, 540] as const, background: [740, 540] as const },
      { id: "image.fit.cover", center: [960, 540] as const, background: [680, 540] as const },
      { id: "image.crop", center: [960, 540] as const, background: [780, 540] as const },
    ];

    for (const fixture of cases) {
      await page.goto(`/docs/preview?case=${fixture.id}&backend=webgl2`);
      const canvas = page.getByTestId("preview-v2-canvas");
      await expect(canvas).toHaveAttribute("data-backend", "webgl2");
      await expect(canvas).toHaveAttribute("data-draw-calls", "1");
      expect(await readWebGLPixel(page, "preview-v2-canvas", ...fixture.center)).not.toEqual([
        16,
        24,
        32,
        255,
      ]);
      expect(await readWebGLPixel(page, "preview-v2-canvas", ...fixture.background)).toEqual([
        16,
        24,
        32,
        255,
      ]);
    }

    await page.goto("/docs/preview?case=image.fit.contain&backend=webgl2");
    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    for (const fixture of cases) {
      await page.goto(`/docs/preview?case=${fixture.id}&backend=webgpu`);
      const canvas = page.getByTestId("preview-v2-canvas");
      await expect(canvas).toHaveAttribute("data-backend", "webgpu");
      await expect(canvas).toHaveAttribute("data-draw-calls", "1");
      await page.waitForTimeout(100);
      expect(await readPresentedPixel(page, "preview-v2-canvas", ...fixture.center)).not.toEqual([
        16,
        24,
        32,
        255,
      ]);
      expect(await readPresentedPixel(page, "preview-v2-canvas", ...fixture.background)).toEqual([
        16,
        24,
        32,
        255,
      ]);
    }
  });

  test("reports a missing Image Atom asset without crashing the preview", async ({ page }) => {
    await page.goto("/docs/preview?case=image.missing-asset&backend=webgl2");
    const canvas = page.getByTestId("preview-v2-canvas");
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).toHaveAttribute("data-draw-calls", "0");
    await expect(canvas).toHaveAttribute("data-diagnostics", /preview_asset_missing/);
  });

  test("seeks the Video Atom to the requested composition frame in both backends", async ({ page }) => {
    for (const backend of ["webgl2", "webgpu"] as const) {
      if (backend === "webgpu") {
        test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
      }
      await page.goto(`/docs/preview?case=video.frame-seek&backend=${backend}&time=0`);
      const canvas = page.getByTestId("preview-v2-canvas");
      await expect(canvas).toHaveAttribute("data-backend", backend);
      await expect(canvas).toHaveAttribute("data-draw-calls", "1");
      await expect(canvas).toHaveAttribute("data-video-times", "video:0.000:visible");
      await page.waitForTimeout(100);
      const firstFrame = backend === "webgl2"
        ? await readWebGLPixel(page, "preview-v2-canvas", 960, 540)
        : await readPresentedPixel(page, "preview-v2-canvas", 960, 540);
      expect(firstFrame).not.toEqual([16, 24, 32, 255]);

      await page.goto(`/docs/preview?case=video.frame-seek&backend=${backend}&time=1`);
      await expect(canvas).toHaveAttribute("data-backend", backend);
      await expect(canvas).toHaveAttribute("data-draw-calls", "1");
      await expect(canvas).toHaveAttribute("data-video-times", "video:1.000:visible");
      await page.waitForTimeout(100);
      const secondFrame = backend === "webgl2"
        ? await readWebGLPixel(page, "preview-v2-canvas", 960, 540)
        : await readPresentedPixel(page, "preview-v2-canvas", 960, 540);
      expect(secondFrame).not.toEqual([16, 24, 32, 255]);
    }
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

  test("renders rounded rectangle corners and stroke in both backends", async ({ page }) => {
    const caseId = "rectangle.rounded";
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );
    const webglFill = await readWebGLPixel(page, "preview-v2-canvas", 960, 510);
    const webglStroke = await readWebGLPixel(page, "preview-v2-canvas", 960, 426);
    const webglCornerOutside = await readWebGLPixel(
      page,
      "preview-v2-canvas",
      805,
      425,
    );
    const webglCornerInside = await readWebGLPixel(
      page,
      "preview-v2-canvas",
      835,
      455,
    );
    expect(webglFill).toEqual([0, 170, 136, 255]);
    expect(webglStroke).toEqual([255, 51, 102, 255]);
    expect(webglCornerOutside).toEqual([16, 24, 32, 255]);
    expect(webglCornerInside).toEqual([0, 170, 136, 255]);

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
    expect(await readPresentedPixel(page, "preview-v2-canvas", 960, 426)).toEqual([
      255,
      51,
      102,
      255,
    ]);
    expect(await readPresentedPixel(page, "preview-v2-canvas", 805, 425)).toEqual([
      16,
      24,
      32,
      255,
    ]);
    expect(await readPresentedPixel(page, "preview-v2-canvas", 835, 455)).toEqual([
      0,
      170,
      136,
      255,
    ]);
  });

  test("keeps rounded rectangle geometry through Matrix4 perspective", async ({ page }) => {
    await page.goto(
      "/docs/preview?case=rectangle.rounded-perspective&backend=webgl2",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );
    const webgl = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgl.bounds).not.toBeNull();
    expect(webgl.fillPixels).toBeGreaterThan(1000);

    await page.goto(
      "/docs/preview?case=rectangle.rounded-perspective&backend=webgl2",
    );
    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(
      "/docs/preview?case=rectangle.rounded-perspective&backend=webgpu",
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

  test("renders linear and radial semantic gradients in both backends", async ({ page }) => {
    const linearPoints = {
      left: [801, 510] as const,
      center: [960, 510] as const,
      right: [1119, 510] as const,
    };
    const radialPoints = {
      center: [960, 510] as const,
      edge: [960, 420] as const,
    };

    await page.goto("/docs/preview?case=rectangle.gradient.linear&backend=webgl2");
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );
    const webglLinearLeft = await readWebGLPixel(page, "preview-v2-canvas", ...linearPoints.left);
    const webglLinearCenter = await readWebGLPixel(page, "preview-v2-canvas", ...linearPoints.center);
    const webglLinearRight = await readWebGLPixel(page, "preview-v2-canvas", ...linearPoints.right);
    expect(webglLinearLeft[0]).toBeGreaterThan(220);
    expect(webglLinearLeft[2]).toBeLessThan(40);
    expect(webglLinearCenter[0]).toBeGreaterThan(100);
    expect(webglLinearCenter[2]).toBeGreaterThan(100);
    expect(webglLinearRight[0]).toBeLessThan(40);
    expect(webglLinearRight[2]).toBeGreaterThan(220);

    await page.goto("/docs/preview?case=ellipse.gradient.radial&backend=webgl2");
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );
    const webglRadialCenter = await readWebGLPixel(page, "preview-v2-canvas", ...radialPoints.center);
    const webglRadialEdge = await readWebGLPixel(page, "preview-v2-canvas", ...radialPoints.edge);
    expect(webglRadialCenter[0]).toBeGreaterThan(240);
    expect(webglRadialCenter[1]).toBeGreaterThan(240);
    expect(webglRadialCenter[2]).toBeGreaterThan(240);
    expect(webglRadialEdge[0]).toBeLessThan(40);
    expect(webglRadialEdge[1]).toBeLessThan(40);
    expect(webglRadialEdge[2]).toBeLessThan(40);

    await page.goto("/docs/preview?case=rectangle.gradient.linear&backend=webgl2");
    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto("/docs/preview?case=rectangle.gradient.linear&backend=webgpu");
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgpu",
    );
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-draw-calls",
      "1",
    );
    const webgpuLinearLeft = await readPresentedPixel(page, "preview-v2-canvas", ...linearPoints.left);
    const webgpuLinearCenter = await readPresentedPixel(page, "preview-v2-canvas", ...linearPoints.center);
    const webgpuLinearRight = await readPresentedPixel(page, "preview-v2-canvas", ...linearPoints.right);
    expect(webgpuLinearLeft[0]).toBeGreaterThan(220);
    expect(webgpuLinearLeft[2]).toBeLessThan(40);
    expect(webgpuLinearCenter[0]).toBeGreaterThan(100);
    expect(webgpuLinearCenter[2]).toBeGreaterThan(100);
    expect(webgpuLinearRight[0]).toBeLessThan(40);
    expect(webgpuLinearRight[2]).toBeGreaterThan(220);

    await page.goto("/docs/preview?case=ellipse.gradient.radial&backend=webgpu");
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgpu",
    );
    const webgpuRadialCenter = await readPresentedPixel(page, "preview-v2-canvas", ...radialPoints.center);
    const webgpuRadialEdge = await readPresentedPixel(page, "preview-v2-canvas", ...radialPoints.edge);
    expect(webgpuRadialCenter[0]).toBeGreaterThan(240);
    expect(webgpuRadialCenter[1]).toBeGreaterThan(240);
    expect(webgpuRadialCenter[2]).toBeGreaterThan(240);
    expect(webgpuRadialEdge[0]).toBeLessThan(40);
    expect(webgpuRadialEdge[1]).toBeLessThan(40);
    expect(webgpuRadialEdge[2]).toBeLessThan(40);
  });

  test("keeps semantic gradient paint through Matrix4 perspective", async ({ page }) => {
    const caseId = "rectangle.gradient.perspective";
    async function countGradientPixels() {
      return page.getByTestId("preview-v2-canvas").evaluate(async (node) => {
        if (!(node instanceof HTMLCanvasElement)) throw new Error("Expected preview canvas");
        const image = new Image();
        image.src = node.toDataURL("image/png");
        await image.decode();
        const capture = document.createElement("canvas");
        capture.width = node.width;
        capture.height = node.height;
        const context = capture.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("2D readback context is not available");
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, capture.width, capture.height).data;
        let count = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (
            (pixels[index]! > 40 && pixels[index + 1]! < 120) ||
            (pixels[index + 2]! > 60 && pixels[index + 1]! < 120)
          ) {
            count += 1;
          }
        }
        return count;
      });
    }

    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-backend",
      "webgl2",
    );
    expect(await countGradientPixels()).toBeGreaterThan(1000);

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
    expect(await countGradientPixels()).toBeGreaterThan(1000);
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
    const sidebar = page.locator('[data-testid="preview-v2-lab"] > aside');
    await expect(canvas).toHaveJSProperty("width", 1920);
    await expect(canvas).toHaveJSProperty("height", 1080);
    await expect(canvas).toHaveAttribute("data-device-pixel-ratio", "1");
    await expect(canvas).toHaveAttribute("data-backing-width", "1920");
    await expect(canvas).toHaveAttribute("data-backing-height", "1080");
    await expect(stage).toBeVisible();
    await expect(sidebar).toBeVisible();
    const sidebarLayout = await sidebar.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        width: rect.width,
        position: getComputedStyle(node).position,
        height: rect.height,
      };
    });
    expect(sidebarLayout.width).toBeGreaterThanOrEqual(300);
    expect(sidebarLayout.position).toBe("sticky");
    expect(sidebarLayout.height).toBeGreaterThan(600);
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

  test("advances a V2 video preview through the playback engine", async ({
    page,
  }) => {
    await page.goto("/docs/preview?case=video.frame-seek&backend=webgl2&time=0");
    const slider = page.getByTestId("preview-time-slider");
    const toggle = page.getByTestId("preview-play-toggle");
    await expect(slider).toHaveValue("0");

    await toggle.click();
    await expect
      .poll(async () => Number(await slider.inputValue()), { timeout: 5_000 })
      .toBeGreaterThan(0.2);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-label", "Play");
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
