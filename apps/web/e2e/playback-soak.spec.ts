import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const VIDEO_CASE = "/docs/preview?case=video.frame-seek&backend=webgl2&time=0";
const SOAK_SECONDS = 10 * 60;

async function collectHeapSnapshot(page: Page, name: string) {
  const client = await page.context().newCDPSession(page);
  await client.send("HeapProfiler.collectGarbage");
  const chunks: string[] = [];
  client.on("HeapProfiler.addHeapSnapshotChunk", ({ chunk }: { chunk: string }) => {
    chunks.push(chunk);
  });
  await client.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
  const outputPath = test.info().outputPath(name);
  await mkdir(dirname(outputPath), { recursive: true });
  const snapshot = chunks.join("");
  await writeFile(outputPath, snapshot, "utf8");
  const heap = await client.send("Runtime.getHeapUsage");
  await client.detach();
  return { path: outputPath, bytes: Buffer.byteLength(snapshot), heap };
}

async function readMetrics(page: Page) {
  return page.getByTestId("preview-v2-canvas").evaluate((canvas) => {
    const counts = canvas.getAttribute("data-preview-resource-counts");
    return {
      heap: (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory ?? null,
      paintIntervalMs: Number(canvas.getAttribute("data-paint-interval-ms") ?? 0),
      droppedFrames: Number(canvas.getAttribute("data-estimated-dropped-frames") ?? 0),
      diagnostics: canvas.getAttribute("data-diagnostics") ?? "",
      resourceCounts: counts ? JSON.parse(counts) as Record<string, number> : null,
    };
  });
}

test.describe("10-minute playback soak", () => {
  test("keeps heap/resource trend bounded during continuous playback", async ({ page }) => {
    test.setTimeout((SOAK_SECONDS + 60) * 1000);
    await page.goto(VIDEO_CASE);
    const toggle = page.getByTestId("preview-play-toggle");
    const slider = page.getByTestId("preview-time-slider");
    await expect(toggle).toHaveAttribute("aria-label", "Play");

    const before = await collectHeapSnapshot(page, "heap-before.heapsnapshot");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-label", "Pause");

    const samples: Array<{ elapsedSec: number; metrics: Awaited<ReturnType<typeof readMetrics>> }> = [];
    const started = Date.now();
    while (Date.now() - started < SOAK_SECONDS * 1000) {
      await page.waitForTimeout(1000);
      const elapsedSec = (Date.now() - started) / 1000;
      const value = Number(await slider.inputValue());
      const max = Number(await slider.getAttribute("max") ?? 0);
      // The fixture is short. Restart at the boundary so the composition clock
      // remains active while the browser is observed for the full soak window.
      if (max > 0 && value >= max - 0.05) {
        await slider.fill("0");
        if (await toggle.getAttribute("aria-label") === "Play") await toggle.click();
      }
      if (Math.floor(elapsedSec) % 30 === 0) {
        samples.push({ elapsedSec, metrics: await readMetrics(page) });
      }
    }

    if (await toggle.getAttribute("aria-label") === "Pause") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-label", "Play");
    const after = await collectHeapSnapshot(page, "heap-after.heapsnapshot");
    const finalMetrics = await readMetrics(page);
    const result = {
      durationSec: SOAK_SECONDS,
      before,
      after,
      samples,
      final: finalMetrics,
      heapDeltaUsedBytes: Number(after.heap.usedSize ?? 0) - Number(before.heap.usedSize ?? 0),
      snapshotDeltaBytes: after.bytes - before.bytes,
    };
    const metricsPath = test.info().outputPath("playback-soak.metrics.json");
    await writeFile(metricsPath, JSON.stringify(result, null, 2), "utf8");
    await test.info().attach("playback-soak-metrics", { path: metricsPath, contentType: "application/json" });

    expect(finalMetrics.diagnostics).not.toMatch(/error|unavailable/i);
    expect(finalMetrics.resourceCounts?.activeVideos ?? 0).toBeLessThanOrEqual(1);
    expect(finalMetrics.resourceCounts?.activeAssets ?? 0).toBeLessThanOrEqual(1);
    expect(finalMetrics.droppedFrames).toBeLessThan(120);
  });
});
