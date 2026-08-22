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
    const adapter = await gpu?.requestAdapter?.();
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

  test("runs the V2 blur effect through isolated WebGL2 and WebGPU passes", async ({ page }) => {
    const caseId = "effect.blur";
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    const canvas = page.getByTestId("preview-v2-canvas");
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /offscreen|compositing_pending/);
    const crispOutside = await readWebGLPixel(page, "preview-v2-canvas", 284, 540);
    const blurredOutside = await readWebGLPixel(page, "preview-v2-canvas", 1244, 540);
    const blurredCenter = await readWebGLPixel(page, "preview-v2-canvas", 1440, 540);
    const profileX = [1160, 1180, 1200, 1220, 1240, 1260, 1280, 1300];
    const webglProfile = await Promise.all(
      profileX.map((x) => readWebGLPixel(page, "preview-v2-canvas", x, 540)),
    );
    expect(crispOutside).toEqual([16, 24, 32, 255]);
    expect(blurredOutside[0]).toBeGreaterThan(20);
    expect(blurredOutside[1]).toBeGreaterThan(24);
    expect(blurredOutside[2]).toBeGreaterThan(32);
    expect(blurredCenter).toEqual([255, 51, 102, 255]);
    expect(new Set(webglProfile.map((pixel) => pixel[0])).size).toBeGreaterThanOrEqual(6);
    for (let index = 1; index < webglProfile.length; index += 1) {
      expect(webglProfile[index]![0]).toBeGreaterThanOrEqual(webglProfile[index - 1]![0]);
    }

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /offscreen|compositing_pending/);
    const webgpuOutside = await readPresentedPixel(page, "preview-v2-canvas", 1244, 540);
    const webgpuCenter = await readPresentedPixel(page, "preview-v2-canvas", 1440, 540);
    const webgpuProfile = await Promise.all(
      profileX.map((x) => readPresentedPixel(page, "preview-v2-canvas", x, 540)),
    );
    expect(webgpuOutside[0]).toBeGreaterThan(20);
    expect(webgpuOutside[1]).toBeGreaterThan(24);
    expect(webgpuOutside[2]).toBeGreaterThan(32);
    for (let index = 0; index < 4; index += 1) {
      expect(Math.abs(webgpuCenter[index]! - blurredCenter[index]!)).toBeLessThanOrEqual(1);
    }
    for (let index = 0; index < webglProfile.length; index += 1) {
      expect(Math.abs(webgpuProfile[index]![0] - webglProfile[index]![0])).toBeLessThanOrEqual(2);
    }
  });

  test("blurs the composited rectangle fill and stroke from one isolated source", async ({ page }) => {
    const caseId = "effect.blur.stroke";
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    const canvas = page.getByTestId("preview-v2-canvas");
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /effect|offscreen/);
    const fillOnlyOutside = await readWebGLPixel(page, "preview-v2-canvas", 284, 540);
    const blurredOutside = await readWebGLPixel(page, "preview-v2-canvas", 1244, 540);
    const blurredCenter = await readWebGLPixel(page, "preview-v2-canvas", 1440, 540);
    expect(fillOnlyOutside[0]).toBeGreaterThan(35);
    expect(blurredOutside[0]).toBeGreaterThan(35);
    expect(blurredOutside[0]).toBeGreaterThanOrEqual(fillOnlyOutside[0]! + 4);
    expect(blurredOutside[1]).toBeLessThanOrEqual(fillOnlyOutside[1]! - 5);
    expect(blurredOutside[2]).toBeLessThanOrEqual(fillOnlyOutside[2]! - 4);
    expect(blurredCenter).toEqual([217, 217, 217, 255]);

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    const webgpuOutside = await readPresentedPixel(page, "preview-v2-canvas", 1244, 540);
    const webgpuCenter = await readPresentedPixel(page, "preview-v2-canvas", 1440, 540);
    for (let index = 0; index < 4; index += 1) {
      expect(Math.abs(webgpuOutside[index]! - blurredOutside[index]!)).toBeLessThanOrEqual(2);
      expect(Math.abs(webgpuCenter[index]! - blurredCenter[index]!)).toBeLessThanOrEqual(2);
    }
  });

  test("renders a Runtime-lowered drop shadow behind its immutable rectangle source", async ({ page }) => {
    const caseId = "effect.drop-shadow";
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    const canvas = page.getByTestId("preview-v2-canvas");
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /effect|offscreen/);
    const sourceCenter = await readWebGLPixel(page, "preview-v2-canvas", 1440, 510);
    const shadowSample = await readWebGLPixel(page, "preview-v2-canvas", 1640, 710);
    expect(sourceCenter).toEqual([217, 217, 217, 255]);
    expect(shadowSample[0]).toBeGreaterThan(50);
    expect(shadowSample[0]).toBeGreaterThan(shadowSample[1]! + 20);
    expect(shadowSample[0]).toBeGreaterThan(shadowSample[2]! + 15);

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    const webgpuShadow = await readPresentedPixel(page, "preview-v2-canvas", 1640, 710);
    for (let index = 0; index < 4; index += 1) {
      expect(Math.abs(webgpuShadow[index]! - shadowSample[index]!)).toBeLessThanOrEqual(2);
    }
  });

  test("certifies signed offsets, zero blur, embedded color alpha, and stroke source capture for drop shadows", async ({ page }) => {
    const canvas = page.getByTestId("preview-v2-canvas");
    const samples: Array<{ caseId: string; points: Array<readonly [number, number]> }> = [
      { caseId: "effect.drop-shadow.negative-offset", points: [[1220, 300]] },
      { caseId: "effect.drop-shadow.zero-blur", points: [[1630, 700]] },
      { caseId: "effect.drop-shadow.alpha-color", points: [[670, 700], [1630, 700]] },
      { caseId: "effect.drop-shadow.stroke-source", points: [[680, 710], [1640, 710]] },
    ];

    const webglResults: number[][][] = [];
    for (const fixture of samples) {
      await page.goto(`/docs/preview?case=${fixture.caseId}&backend=webgl2`);
      await expect(canvas).toHaveAttribute("data-backend", "webgl2");
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /effect|offscreen/);
      webglResults.push(await Promise.all(
        fixture.points.map(([x, y]) => readWebGLPixel(page, "preview-v2-canvas", x, y)),
      ));
    }

    const [negative, zeroBlur, alphaColor, strokeSource] = webglResults;
    expect(negative![0]![2]).toBeGreaterThan(negative![0]![0] + 15);
    expect(negative![0]![2]).toBeGreaterThan(negative![0]![1] + 8);
    expect(zeroBlur![0]![0]).toBeGreaterThan(zeroBlur![0]![1] + 50);
    expect(zeroBlur![0]![0]).toBeGreaterThan(zeroBlur![0]![2] + 20);
    expect(alphaColor![1]![2]).toBeGreaterThan(alphaColor![0]![2] + 50);
    expect(strokeSource![1]![0]).toBeGreaterThan(strokeSource![0]![0] + 50);

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    for (const [fixtureIndex, fixture] of samples.entries()) {
      await page.goto(`/docs/preview?case=${fixture.caseId}&backend=webgpu`);
      await expect(canvas).toHaveAttribute("data-backend", "webgpu");
      const webgpu = await Promise.all(
        fixture.points.map(([x, y]) => readPresentedPixel(page, "preview-v2-canvas", x, y)),
      );
      for (const [pointIndex, pixel] of webgpu.entries()) {
        for (let channel = 0; channel < 4; channel += 1) {
          expect(Math.abs(pixel[channel]! - webglResults[fixtureIndex]![pointIndex]![channel]!)).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  test("renders outer glow behind the immutable source and includes source stroke coverage", async ({ page }) => {
    const canvas = page.getByTestId("preview-v2-canvas");
    await page.goto("/docs/preview?case=effect.outer-glow&backend=webgl2");
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /effect|offscreen/);
    const sourceCenter = await readWebGLPixel(page, "preview-v2-canvas", 1440, 510);
    const halo = await readWebGLPixel(page, "preview-v2-canvas", 1630, 510);
    expect(sourceCenter).toEqual([217, 217, 217, 255]);
    expect(halo[1]).toBeGreaterThan(halo[0] + 30);
    expect(halo[2]).toBeGreaterThan(halo[0] + 40);

    await page.goto("/docs/preview?case=effect.outer-glow.stroke-source&backend=webgl2");
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /effect|offscreen/);
    const fillOnlyHalo = await readWebGLPixel(page, "preview-v2-canvas", 670, 510);
    const strokeHalo = await readWebGLPixel(page, "preview-v2-canvas", 1630, 510);
    expect(strokeHalo[0]).toBeGreaterThan(fillOnlyHalo[0] + 15);

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto("/docs/preview?case=effect.outer-glow&backend=webgpu");
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    const webgpuHalo = await readPresentedPixel(page, "preview-v2-canvas", 1630, 510);
    for (let index = 0; index < 4; index += 1) {
      expect(Math.abs(webgpuHalo[index]! - halo[index]!)).toBeLessThanOrEqual(2);
    }

    await page.goto("/docs/preview?case=effect.outer-glow.stroke-source&backend=webgpu");
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    const webgpuStrokeHalo = await readPresentedPixel(page, "preview-v2-canvas", 1630, 510);
    for (let index = 0; index < 4; index += 1) {
      expect(Math.abs(webgpuStrokeHalo[index]! - strokeHalo[index]!)).toBeLessThanOrEqual(2);
    }
  });

  test("preserves observable color-adjust and blur order", async ({ page }) => {
    const caseId = "effect.order";
    const samplePoints = [420, 450, 480, 510];
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    const canvas = page.getByTestId("preview-v2-canvas");
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /effect|offscreen/);
    const beforeBlur = await Promise.all(samplePoints.map((x) => readWebGLPixel(page, "preview-v2-canvas", x, 540)));
    const afterBlur = await Promise.all(samplePoints.map((x) => readWebGLPixel(page, "preview-v2-canvas", x + 960, 540)));
    expect(beforeBlur.some((pixel, index) => Math.abs(pixel[0] - afterBlur[index]![0]) >= 8)).toBe(true);

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    const webgpuBefore = await Promise.all(samplePoints.map((x) => readPresentedPixel(page, "preview-v2-canvas", x, 540)));
    const webgpuAfter = await Promise.all(samplePoints.map((x) => readPresentedPixel(page, "preview-v2-canvas", x + 960, 540)));
    for (let index = 0; index < samplePoints.length; index += 1) {
      expect(Math.abs(webgpuBefore[index]![0] - beforeBlur[index]![0])).toBeLessThanOrEqual(2);
      expect(Math.abs(webgpuAfter[index]![0] - afterBlur[index]![0])).toBeLessThanOrEqual(2);
    }
  });

  test("renders deterministic noise only on the effected surface", async ({ page }) => {
    const caseId = "effect.noise";
    const canvas = page.getByTestId("preview-v2-canvas");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /effect|offscreen/);
    expect(await readWebGLPixel(page, "preview-v2-canvas", 430, 510)).toEqual([217, 217, 217, 255]);
    const grainSamples = await Promise.all([
      [1480, 480], [1496, 480], [1512, 480], [1480, 496], [1496, 496], [1512, 496],
    ].map(([x, y]) => readWebGLPixel(page, "preview-v2-canvas", x, y)));
    expect(new Set(grainSamples.map((pixel) => pixel.join(","))).size).toBeGreaterThan(1);

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /effect|offscreen/);
    const webgpuGrain = await readPresentedPixel(page, "preview-v2-canvas", 1496, 496);
    const webglGrain = grainSamples[4]!;
    for (let channel = 0; channel < 4; channel += 1) {
      expect(Math.abs(webgpuGrain[channel]! - webglGrain[channel]!)).toBeLessThanOrEqual(2);
    }
  });

  test("executes two consecutive blur operators in order", async ({ page }) => {
    const caseId = "effect.blur-chain";
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    const canvas = page.getByTestId("preview-v2-canvas");
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /effect|offscreen/);
    const singleOutside = await readWebGLPixel(page, "preview-v2-canvas", 280, 540);
    const doubleOutside = await readWebGLPixel(page, "preview-v2-canvas", 1240, 540);
    expect(doubleOutside[0]).toBeGreaterThan(singleOutside[0] + 5);

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    const webgpuOutside = await readPresentedPixel(page, "preview-v2-canvas", 1240, 540);
    expect(Math.abs(webgpuOutside[0] - doubleOutside[0])).toBeLessThanOrEqual(2);
  });

  for (const radius of [4, 40, 256]) {
    test(`certifies blur radius ${radius} with a clean monotonic edge`, async ({ page }) => {
      const caseId = `effect.blur.radius-${radius}`;
      const spread = Math.min(radius * 2, 220);
      const profileX = Array.from({ length: 9 }, (_, index) =>
        Math.round(360 - spread + (spread * 2 * index) / 8),
      );
      await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
      const canvas = page.getByTestId("preview-v2-canvas");
      await expect(canvas).toHaveAttribute("data-backend", "webgl2");
      await expect(canvas).not.toHaveAttribute("data-diagnostics", /effect|offscreen/);
      const center = await readWebGLPixel(page, "preview-v2-canvas", 960, 540);
      const profile = await Promise.all(profileX.map((x) => readWebGLPixel(page, "preview-v2-canvas", x, 540)));
      expect(center[0]).toBeGreaterThan(220);
      expect(center[3]).toBe(255);
      for (let index = 1; index < profile.length; index += 1) {
        expect(profile[index]![0]).toBeGreaterThanOrEqual(profile[index - 1]![0] - 1);
      }
      for (const pixel of profile) {
        expect(pixel[0]).toBeGreaterThanOrEqual(16);
        expect(pixel[1]).toBeGreaterThanOrEqual(24);
        expect(pixel[2]).toBeGreaterThanOrEqual(32);
      }

      test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
      await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
      await expect(canvas).toHaveAttribute("data-backend", "webgpu");
      const webgpuCenter = await readPresentedPixel(page, "preview-v2-canvas", 960, 540);
      expect(Math.abs(webgpuCenter[0] - center[0])).toBeLessThanOrEqual(2);
      expect(Math.abs(webgpuCenter[1] - center[1])).toBeLessThanOrEqual(2);
      expect(Math.abs(webgpuCenter[2] - center[2])).toBeLessThanOrEqual(2);
    });
  }

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

  test("presents the top-left rectangle without vertically flipping WebGPU textures", async ({ page }) => {
    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto("/docs/preview?case=primitive.shape.rectangle&backend=webgpu");
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute("data-backend", "webgpu");
    expect(await readPresentedPixel(page, "preview-v2-canvas", 48, 32)).toEqual([0, 170, 136, 255]);
    expect(await readPresentedPixel(page, "preview-v2-canvas", 48, 1047)).toEqual([16, 24, 32, 255]);
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

  test("renders Group parent transforms as one isolated subtree", async ({ page }) => {
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
    // Two child draws, then decode and composite the isolated subtree.
    await expect(page.getByTestId("preview-v2-canvas")).toHaveAttribute(
      "data-draw-calls",
      "4",
    );
    const webgpu = await analyzePresentedCanvas(page, "preview-v2-canvas");
    expect(webgpu.bounds).not.toBeNull();
    expect(webgpu.fillPixels).toBeGreaterThan(5_000);
    expect(Math.abs(webgpu.bounds!.left - webgl.bounds!.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(webgpu.bounds!.top - webgl.bounds!.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(webgpu.bounds!.right - webgl.bounds!.right)).toBeLessThanOrEqual(1);
    expect(Math.abs(webgpu.bounds!.bottom - webgl.bounds!.bottom)).toBeLessThanOrEqual(1);
  });

  test("composites group opacity once after opaque children overlap", async ({ page }) => {
    const caseId = "group.isolation.opacity";
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    const canvas = page.getByTestId("preview-v2-canvas");
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /isolation|offscreen|pending/);
    const overlap = await readWebGLPixel(page, "preview-v2-canvas", 800, 540);
    const frontOnly = await readWebGLPixel(page, "preview-v2-canvas", 1100, 540);
    for (let channel = 0; channel < 4; channel += 1) {
      expect(Math.abs(overlap[channel]! - frontOnly[channel]!)).toBeLessThanOrEqual(1);
    }

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /isolation|offscreen|pending/);
    const webgpuOverlap = await readPresentedPixel(page, "preview-v2-canvas", 800, 540);
    const webgpuFrontOnly = await readPresentedPixel(page, "preview-v2-canvas", 1100, 540);
    for (let channel = 0; channel < 4; channel += 1) {
      expect(Math.abs(webgpuOverlap[channel]! - webgpuFrontOnly[channel]!)).toBeLessThanOrEqual(2);
      expect(Math.abs(webgpuOverlap[channel]! - overlap[channel]!)).toBeLessThanOrEqual(2);
    }
  });

  test("composites nested isolation scopes from inner to outer", async ({ page }) => {
    const caseId = "group.isolation.nested";
    const canvas = page.getByTestId("preview-v2-canvas");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /isolation|layer|pending/);
    await expect(canvas).toHaveAttribute("data-draw-calls", "6");
    const webglOverlap = await readWebGLPixel(page, "preview-v2-canvas", 800, 540);
    const webglFrontOnly = await readWebGLPixel(page, "preview-v2-canvas", 1100, 540);
    for (let channel = 0; channel < 4; channel += 1) {
      expect(Math.abs(webglOverlap[channel]! - webglFrontOnly[channel]!)).toBeLessThanOrEqual(1);
    }

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /isolation|layer|pending/);
    await expect(canvas).toHaveAttribute("data-draw-calls", "6");
    const webgpuOverlap = await readPresentedPixel(page, "preview-v2-canvas", 800, 540);
    const webgpuFrontOnly = await readPresentedPixel(page, "preview-v2-canvas", 1100, 540);
    for (let channel = 0; channel < 4; channel += 1) {
      expect(Math.abs(webgpuOverlap[channel]! - webgpuFrontOnly[channel]!)).toBeLessThanOrEqual(2);
      expect(Math.abs(webgpuOverlap[channel]! - webglOverlap[channel]!)).toBeLessThanOrEqual(2);
    }
  });

  test("composites a nested alpha mask inside an isolated group", async ({ page }) => {
    const caseId = "composite.mask.nested";
    const canvas = page.getByTestId("preview-v2-canvas");
    const background = [16, 24, 32, 255];
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /mask|isolation|layer|pending/);
    await expect(canvas).toHaveAttribute("data-draw-calls", "5");
    const webglInside = await readWebGLPixel(page, "preview-v2-canvas", 960, 540);
    const webglOutside = await readWebGLPixel(page, "preview-v2-canvas", 500, 220);
    expect(webglInside).not.toEqual(background);
    expect(webglOutside).toEqual(background);

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /mask|isolation|layer|pending/);
    await expect(canvas).toHaveAttribute("data-draw-calls", "6");
    const webgpuInside = await readPresentedPixel(page, "preview-v2-canvas", 960, 540);
    const webgpuOutside = await readPresentedPixel(page, "preview-v2-canvas", 500, 220);
    for (let channel = 0; channel < 4; channel += 1) {
      expect(Math.abs(webgpuInside[channel]! - webglInside[channel]!)).toBeLessThanOrEqual(2);
      expect(Math.abs(webgpuOutside[channel]! - webglOutside[channel]!)).toBeLessThanOrEqual(2);
    }
  });

  test("clips a group through a mask-only ellipse in both native backends", async ({ page }) => {
    const caseId = "composite.mask.clip";
    const canvas = page.getByTestId("preview-v2-canvas");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /clip|mask|pending/);
    await expect(canvas).toHaveAttribute("data-draw-calls", "3");
    const webglInside = await readWebGLPixel(page, "preview-v2-canvas", 960, 540);
    const webglOutside = await readWebGLPixel(page, "preview-v2-canvas", 500, 220);
    expect(webglInside).not.toEqual([16, 24, 32, 255]);
    expect(webglOutside).toEqual([16, 24, 32, 255]);

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /clip|mask|pending/);
    await expect(canvas).toHaveAttribute("data-draw-calls", "4");
    const webgpuInside = await readPresentedPixel(page, "preview-v2-canvas", 960, 540);
    const webgpuOutside = await readPresentedPixel(page, "preview-v2-canvas", 500, 220);
    for (let channel = 0; channel < 4; channel += 1) {
      expect(Math.abs(webgpuInside[channel]! - webglInside[channel]!)).toBeLessThanOrEqual(2);
      expect(Math.abs(webgpuOutside[channel]! - webglOutside[channel]!)).toBeLessThanOrEqual(2);
    }
  });

  test("preserves an alpha-mask source's partial coverage in both native backends", async ({ page }) => {
    const canvas = page.getByTestId("preview-v2-canvas");
    const background = [16, 24, 32, 255];
    const distanceFromBackground = (pixel: number[]) => pixel.reduce(
      (total, channel, index) => total + Math.abs(channel - background[index]!),
      0,
    );
    await page.goto("/docs/preview?case=composite.mask.clip&backend=webgl2");
    const clipCenter = await readWebGLPixel(page, "preview-v2-canvas", 960, 540);
    await page.goto("/docs/preview?case=composite.mask.alpha&backend=webgl2");
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /alpha|mask|pending/);
    const alphaCenter = await readWebGLPixel(page, "preview-v2-canvas", 960, 540);
    const alphaOutside = await readWebGLPixel(page, "preview-v2-canvas", 500, 220);
    expect(alphaOutside).toEqual(background);
    expect(distanceFromBackground(alphaCenter)).toBeGreaterThan(5);
    expect(distanceFromBackground(alphaCenter)).toBeLessThan(distanceFromBackground(clipCenter));

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto("/docs/preview?case=composite.mask.alpha&backend=webgpu");
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /alpha|mask|pending/);
    const webgpuCenter = await readPresentedPixel(page, "preview-v2-canvas", 960, 540);
    const webgpuOutside = await readPresentedPixel(page, "preview-v2-canvas", 500, 220);
    for (let channel = 0; channel < 4; channel += 1) {
      expect(Math.abs(webgpuCenter[channel]! - alphaCenter[channel]!)).toBeLessThanOrEqual(2);
      expect(Math.abs(webgpuOutside[channel]! - alphaOutside[channel]!)).toBeLessThanOrEqual(2);
    }
  });

  test("inverts an alpha-mask source in both native backends", async ({ page }) => {
    const canvas = page.getByTestId("preview-v2-canvas");
    const background = [16, 24, 32, 255];
    await page.goto("/docs/preview?case=composite.mask.inverse-alpha&backend=webgl2");
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /inverse|mask|pending/);
    await expect(canvas).toHaveAttribute("data-draw-calls", "3");
    const webglCenter = await readWebGLPixel(page, "preview-v2-canvas", 960, 540);
    const webglOutside = await readWebGLPixel(page, "preview-v2-canvas", 500, 220);
    expect(webglCenter).toEqual(background);
    expect(webglOutside).not.toEqual(background);

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto("/docs/preview?case=composite.mask.inverse-alpha&backend=webgpu");
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /inverse|mask|pending/);
    await expect(canvas).toHaveAttribute("data-draw-calls", "4");
    const webgpuCenter = await readPresentedPixel(page, "preview-v2-canvas", 960, 540);
    const webgpuOutside = await readPresentedPixel(page, "preview-v2-canvas", 500, 220);
    for (let channel = 0; channel < 4; channel += 1) {
      expect(Math.abs(webgpuCenter[channel]! - webglCenter[channel]!)).toBeLessThanOrEqual(2);
      expect(Math.abs(webgpuOutside[channel]! - webglOutside[channel]!)).toBeLessThanOrEqual(2);
    }
  });

  test("uses source luminance as mask coverage in both native backends", async ({ page }) => {
    const canvas = page.getByTestId("preview-v2-canvas");
    const background = [16, 24, 32, 255];
    const distanceFromBackground = (pixel: number[]) => pixel.reduce(
      (total, channel, index) => total + Math.abs(channel - background[index]!),
      0,
    );
    await page.goto("/docs/preview?case=composite.mask.alpha&backend=webgl2");
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    const alphaCenter = await readWebGLPixel(page, "preview-v2-canvas", 960, 540);
    await page.goto("/docs/preview?case=composite.mask.luma&backend=webgl2");
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /luma|mask|pending/);
    await expect(canvas).toHaveAttribute("data-draw-calls", "3");
    const lumaCenter = await readWebGLPixel(page, "preview-v2-canvas", 960, 540);
    const lumaOutside = await readWebGLPixel(page, "preview-v2-canvas", 500, 220);
    expect(lumaOutside).toEqual(background);
    expect(distanceFromBackground(lumaCenter)).toBeGreaterThan(5);
    expect(distanceFromBackground(lumaCenter)).toBeLessThan(distanceFromBackground(alphaCenter));

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto("/docs/preview?case=composite.mask.luma&backend=webgpu");
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /luma|mask|pending/);
    await expect(canvas).toHaveAttribute("data-draw-calls", "4");
    const webgpuCenter = await readPresentedPixel(page, "preview-v2-canvas", 960, 540);
    const webgpuOutside = await readPresentedPixel(page, "preview-v2-canvas", 500, 220);
    for (let channel = 0; channel < 4; channel += 1) {
      expect(Math.abs(webgpuCenter[channel]! - lumaCenter[channel]!)).toBeLessThanOrEqual(2);
      expect(Math.abs(webgpuOutside[channel]! - lumaOutside[channel]!)).toBeLessThanOrEqual(2);
    }
  });

  test("renders every certified image blend mode with WebGPU/WebGL2 parity", async ({ page }) => {
    const cases = [
      "composite.blend.normal",
      "composite.blend.multiply",
      "composite.blend.screen",
      "composite.blend.add",
    ] as const;
    const canvas = page.getByTestId("preview-v2-canvas");
    const webglSamples: number[][] = [];
    for (const caseId of cases) {
      await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
      await expect(canvas).toHaveAttribute("data-backend", "webgl2");
      await page.waitForTimeout(120);
      webglSamples.push(await readWebGLPixel(page, "preview-v2-canvas", 960, 540));
    }
    expect(webglSamples.every((sample) => sample.join(",") !== "16,24,32,255")).toBe(true);
    expect(new Set(webglSamples.map((sample) => sample.join(","))).size).toBe(cases.length);

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    for (const [index, caseId] of cases.entries()) {
      await page.goto(`/docs/preview?case=${caseId}&backend=webgpu`);
      await expect(canvas).toHaveAttribute("data-backend", "webgpu");
      await page.waitForTimeout(120);
      const webgpu = await readPresentedPixel(page, "preview-v2-canvas", 960, 540);
      for (let channel = 0; channel < 4; channel += 1) {
        expect(Math.abs(webgpu[channel]! - webglSamples[index]![channel]!)).toBeLessThanOrEqual(2);
      }
    }
  });

  test("applies image-stack blend mode from the upper snow layer onto the lower image", async ({ page }) => {
    const canvas = page.getByTestId("preview-v2-canvas");
    const samplePoints = [[960, 540], [1200, 500], [780, 680]] as const;
    const samplesByCase: Record<string, number[][]> = {};
    for (const caseId of ["composite.blend.stack.normal", "composite.blend.stack.screen"] as const) {
      await page.goto(`/docs/preview?case=${caseId}&backend=webgl2`);
      await expect(canvas).toHaveAttribute("data-backend", "webgl2");
      await expect(canvas).toHaveAttribute("data-draw-calls", "2");
      await page.waitForTimeout(160);
      samplesByCase[caseId] = await Promise.all(
        samplePoints.map(([x, y]) => readWebGLPixel(page, "preview-v2-canvas", x, y)),
      );
    }
    expect(samplesByCase["composite.blend.stack.normal"]).not.toEqual(
      samplesByCase["composite.blend.stack.screen"],
    );

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto("/docs/preview?case=composite.blend.stack.screen&backend=webgpu");
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    await expect(canvas).toHaveAttribute("data-draw-calls", "2");
    await page.waitForTimeout(160);
    const webgpu = await Promise.all(
      samplePoints.map(([x, y]) => readPresentedPixel(page, "preview-v2-canvas", x, y)),
    );
    for (const [index, sample] of webgpu.entries()) {
      for (let channel = 0; channel < 4; channel += 1) {
        expect(Math.abs(sample[channel]! - samplesByCase["composite.blend.stack.screen"]![index]![channel]!)).toBeLessThanOrEqual(2);
      }
    }
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
