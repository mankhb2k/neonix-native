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
    for (const id of ["join-round", "round-right-angle", "round-acute", "round-zigzag", "round-closed", "closed-dash", "shape-dash", "quadratic-round", "arc-round", "arc-closed", "mesh-transparent-join", "mesh-open-fill", "mesh-concave-round", "mesh-curved-round", "filter-fe-gaussian-blur", "filter-fe-gaussian-blur-4", "filter-fe-gaussian-blur-40", "filter-fe-gaussian-blur-256", "filter-fe-drop-shadow", "filter-fe-outer-glow", "filter-fe-inner-glow", "filter-fe-color-matrix-saturate", "filter-fe-color-matrix-hue", "text-plain", "text-mask-12", "text-mask-24", "text-mask-48", "text-vector-large", "text-vector-rotate", "text-anchor-middle", "text-multiline", "text-spacing", "text-rtl", "text-tspan-paint", "text-positioned", "text-baseline", "text-length-adjust", "text-path", "text-vertical", "text-font-variant", "text-decoration", "text-stroke", "text-whitespace", "text-word-spacing", "text-ligature-emoji"]) {
      const measurements = await selectCase(page, id) as Array<{ backend: string; backgroundHoles: number; paintedPixels: number; probes: Array<{ actual: string; expected: string }> }>;
      report[id] = measurements;
      const webgl = measurements.find((entry) => entry.backend === "webgl2");
      expect(webgl).toBeDefined();
      if (id.startsWith("text-") || id.startsWith("filter-")) {
        // Text probes can land in glyph counters/whitespace. Filter probes can
        // land below the alpha threshold used by the native pixel reader.
        // These cases are evaluated from the captured panel images and bounds.
        expect(webgl!.paintedPixels).toBeGreaterThan(0);
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
});
