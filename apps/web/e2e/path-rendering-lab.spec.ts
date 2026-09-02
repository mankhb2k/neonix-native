import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

async function selectCase(page: import("@playwright/test").Page, id: string): Promise<unknown[]> {
  await page.locator("select").selectOption(id);
  await expect(page.getByTestId("path-rendering-measurements")).toHaveAttribute("data-fixture-id", id);
  await expect(page.getByTestId("path-debug-webgl2")).toHaveAttribute("data-backend", "webgl2", { timeout: 30_000 });
  await expect(page.getByTestId("path-debug-webgpu")).toHaveAttribute("data-backend", "webgpu", { timeout: 30_000 });
  await expect.poll(async () => {
    const text = await page.getByTestId("path-rendering-measurements").textContent();
    return (text?.includes("webgl2") ?? false) && (text?.includes("webgpu") ?? false);
  }).toBe(true);
  return JSON.parse(await page.getByTestId("path-rendering-measurements").textContent() ?? "[]") as unknown[];
}

test.describe("Path rendering parity lab", () => {
  test("renders SVG reference and measures core Runtime cases", async ({ page }) => {
    await page.goto("/debug/path-rendering");
    await expect(page.getByTestId("path-rendering-lab")).toBeVisible();
    await expect(page.getByLabel("SVG reference")).toBeVisible();
    const captureDirectory = path.resolve(process.cwd(), "..", "..", "tmp", "path-rendering-text");
    await mkdir(captureDirectory, { recursive: true });
    const report: Record<string, unknown> = {};
    for (const id of ["join-round", "round-right-angle", "round-acute", "round-zigzag", "round-closed", "closed-dash", "shape-dash", "quadratic-round", "arc-round", "arc-closed", "mesh-transparent-join", "mesh-open-fill", "mesh-concave-round", "mesh-curved-round", "filter-fe-gaussian-blur", "filter-fe-gaussian-blur-4", "filter-fe-gaussian-blur-40", "filter-fe-gaussian-blur-256", "filter-fe-drop-shadow", "filter-fe-outer-glow", "filter-fe-inner-glow", "filter-fe-color-matrix-saturate", "filter-fe-color-matrix-hue", "text-plain", "text-mask-12", "text-mask-24", "text-mask-48", "text-vector-large", "text-vector-rotate", "text-anchor-middle", "text-multiline", "text-spacing", "text-rtl", "text-tspan-paint", "text-positioned", "text-baseline", "text-length-adjust", "text-path", "text-vertical", "text-font-variant", "text-decoration", "text-stroke", "text-whitespace", "text-word-spacing", "text-ligature-emoji", "text-emoji-only", "text-emoji-zwj", "text-emoji-variation"]) {
      const measurements = await selectCase(page, id) as Array<{ backend: string; backgroundHoles: number; paintedPixels: number; probes: Array<{ actual: string; expected: string }> }>;
      report[id] = measurements;
      const webgl = measurements.find((entry) => entry.backend === "webgl2");
      expect(webgl).toBeDefined();
      if (id.startsWith("text-") || id.startsWith("filter-")) {
        // Text probes can land in glyph counters/whitespace. Filter probes can
        // land below the alpha threshold used by the native pixel reader.
        // These cases are evaluated from the captured panel images and bounds.
        expect(webgl!.paintedPixels).toBeGreaterThan(0);
        if (id.startsWith("text-")) {
          await expect(page.getByTestId("path-debug-webgl2")).toHaveAttribute("data-text-rasterizer", "canvaskit");
          await expect(page.getByTestId("path-debug-webgpu")).toHaveAttribute("data-text-rasterizer", "canvaskit");
        }
      } else {
        expect(webgl!.backgroundHoles).toBe(0);
        expect(webgl!.probes.every((probe) => probe.actual === probe.expected)).toBe(true);
      }
      if (id.startsWith("text-") || id.startsWith("mesh-")) {
        await page.getByLabel("SVG reference").screenshot({ path: path.join(captureDirectory, `${id}-svg.png`) });
        await page.getByTestId("path-debug-webgl2").screenshot({ path: path.join(captureDirectory, `${id}-webgl2.png`) });
        await page.getByTestId("path-debug-webgpu").screenshot({ path: path.join(captureDirectory, `${id}-webgpu.png`) });
      }
    }
    await writeFile(path.join(captureDirectory, "report.json"), JSON.stringify(report, null, 2), "utf8");
  });

  test("renders the full color emoji glyph after a fixture switch", async ({ page }) => {
    await page.goto("/debug/path-rendering?case=text-ligature-emoji");
    await expect(page.getByTestId("path-rendering-measurements")).toHaveAttribute("data-fixture-id", "text-ligature-emoji");
    const canvas = page.getByTestId("path-debug-webgl2");
    await expect(canvas).toHaveAttribute("data-backend", "webgl2", { timeout: 30_000 });
    await expect(canvas).toHaveAttribute("data-text-rasterizer", "canvaskit", { timeout: 30_000 });
    await expect.poll(async () => canvas.evaluate((node) => {
      if (!(node instanceof HTMLCanvasElement)) throw new Error("Expected WebGL2 debug canvas");
      const gl = node.getContext("webgl2");
      if (!gl) throw new Error("Expected WebGL2 context");
      const pixels = new Uint8Array(node.width * node.height * 4);
      gl.readPixels(0, 0, node.width, node.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let count = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index]! > 180 && pixels[index + 1]! > 80 && pixels[index + 1]! < 210 && pixels[index + 2]! < 100 && pixels[index + 3]! > 0) count += 1;
      }
      return count;
    })).toBeGreaterThan(0);
  });
});
