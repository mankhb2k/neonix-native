import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PREVIEW_LAB_CASES } from "../lib/docs/preview-lab";
import { decodeRgbaPng } from "../../../apps/remotion-site/src/png";

const OUTPUT_ROOT = path.resolve(process.cwd(), "../../tmp/remotion-v2-preview-parity");

async function previewPng(page: Page): Promise<Buffer> {
  const dataUrl = await page.getByTestId("preview-v2-canvas").evaluate((node: Element) => {
    if (!(node instanceof HTMLCanvasElement)) throw new Error("Expected preview canvas");
    return node.toDataURL("image/png");
  });
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

function outputPath(caseId: string): string {
  return path.join(OUTPUT_ROOT, `${caseId.replaceAll(".", "-")}.png`);
}

test.describe("Remotion PNG versus native preview", () => {
  test("matches the WebGL2 preview canvas for every shared V2 fixture", async ({ page }) => {
    test.setTimeout(180_000);
    for (const fixture of PREVIEW_LAB_CASES) {
      const exportPng = decodeRgbaPng(await readFile(outputPath(fixture.id)));
      await page.goto(`/docs/preview?case=${fixture.id}&backend=webgl2&time=${fixture.previewTime ?? 0}`);
      const canvas = page.getByTestId("preview-v2-canvas");
      await expect(canvas).toHaveAttribute("data-backend", "webgl2");
      await expect.poll(async () => canvas.getAttribute("data-diagnostics")).not.toBeNull();
      const preview = decodeRgbaPng(await previewPng(page));
      expect(preview.width).toBe(exportPng.width);
      expect(preview.height).toBe(exportPng.height);

      let maxDelta = 0;
      let mismatchedPixels = 0;
      for (let offset = 0; offset < preview.pixels.length; offset += 4) {
        let pixelMismatch = false;
        for (let channel = 0; channel < 4; channel += 1) {
          const delta = Math.abs(preview.pixels[offset + channel]! - exportPng.pixels[offset + channel]!);
          maxDelta = Math.max(maxDelta, delta);
          if (delta > 2) pixelMismatch = true;
        }
        if (pixelMismatch) mismatchedPixels += 1;
      }
      const mismatchRatio = mismatchedPixels / (preview.width * preview.height);
      expect(maxDelta, fixture.id).toBeLessThanOrEqual(2);
      expect(mismatchRatio, fixture.id).toBeLessThanOrEqual(0.001);
    }
  });
});
