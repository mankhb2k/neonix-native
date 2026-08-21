import { expect, test, type Page } from "@playwright/test";
import { analyzePresentedCanvas } from "./helpers/preview-pixels";

const PARITY_CASES = [
  "matrix4.2d.identity",
  "matrix4.2d.rotate-z",
  "matrix4.2d.skew",
  "matrix4.3d.rotate-x",
  "matrix4.3d.rotate-y",
  "matrix4.3d.translate-z",
  "matrix4.3d.anchor-z",
  "matrix4.camera-plane",
] as const;

async function supportsWebGPU(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const gpu = (navigator as Navigator & {
      gpu?: {
        requestAdapter?: () => Promise<{
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

async function readCase(
  page: Page,
  caseId: (typeof PARITY_CASES)[number],
  backend: "webgl2" | "webgpu",
) {
  await page.goto(`/docs/preview?case=${caseId}&backend=${backend}`);
  const canvas = page.getByTestId("preview-v2-canvas");
  await expect(canvas).toHaveAttribute("data-backend", backend);
  return {
    analysis: await analyzePresentedCanvas(page, "preview-v2-canvas"),
    diagnostics: await canvas.getAttribute("data-diagnostics"),
  };
}

test.describe("Task 5.95 Matrix4 parity", () => {
  test("certifies all eight cases across WebGL2 and WebGPU", async ({ page }) => {
    const webgl = new Map<string, Awaited<ReturnType<typeof readCase>>>();
    for (const caseId of PARITY_CASES) {
      webgl.set(caseId, await readCase(page, caseId, "webgl2"));
    }

    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");

    for (const caseId of PARITY_CASES) {
      const webgpu = await readCase(page, caseId, "webgpu");
      const webglResult = webgl.get(caseId)!;
      const webglBounds = webglResult.analysis.bounds;
      const webgpuBounds = webgpu.analysis.bounds;

      if (caseId === "matrix4.camera-plane") {
        expect(webglResult.analysis.center).toEqual([16, 24, 32, 255]);
        expect(webgpu.analysis.center).toEqual([16, 24, 32, 255]);
        expect(webglBounds).toBeNull();
        expect(webgpuBounds).toBeNull();
        expect(webglResult.diagnostics).toContain("layer_behind_camera");
        expect(webgpu.diagnostics).toContain("layer_behind_camera");
        expect(webglResult.analysis.darkFringePixels).toBe(0);
        expect(webgpu.analysis.darkFringePixels).toBe(0);
        continue;
      }

      expect(webglBounds).not.toBeNull();
      expect(webgpuBounds).not.toBeNull();
      expect(webglResult.analysis.fillPixels).toBeGreaterThan(1000);
      expect(webgpu.analysis.fillPixels).toBeGreaterThan(1000);
      expect(webglResult.analysis.darkFringePixels).toBe(0);
      expect(webgpu.analysis.darkFringePixels).toBe(0);
      expect(webglResult.diagnostics).toBe("");
      expect(webgpu.diagnostics).toBe("");

      expect(Math.abs(webgpuBounds!.left - webglBounds!.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(webgpuBounds!.top - webglBounds!.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(webgpuBounds!.right - webglBounds!.right)).toBeLessThanOrEqual(1);
      expect(Math.abs(webgpuBounds!.bottom - webglBounds!.bottom)).toBeLessThanOrEqual(1);
    }
  });

  test("keeps the orthographic identity baseline pixel-stable", async ({ page }) => {
    const result = await readCase(page, "matrix4.2d.identity", "webgl2");
    expect(result.analysis.bounds).toEqual({
      left: 800,
      top: 420,
      right: 1119,
      bottom: 599,
    });
    expect(result.analysis.center).toEqual([0, 170, 136, 255]);
    expect(result.analysis.darkFringePixels).toBe(0);
  });
});
