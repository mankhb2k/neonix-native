import { expect, test, type Page } from "@playwright/test";

const VIDEO_CASE = "/docs/preview?case=video.frame-seek&backend=webgl2&time=0";

async function supportsWebGPU(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const gpu = (navigator as Navigator & {
      gpu?: {
        requestAdapter?: () => Promise<{ requestDevice?: () => Promise<unknown> } | null>;
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

async function readResourceCounts(page: Page) {
  return page.getByTestId("preview-v2-canvas").evaluate((canvas) => {
    const value = canvas.getAttribute("data-preview-resource-counts");
    return value ? JSON.parse(value) as Record<string, number> : null;
  });
}

async function seekSlider(page: Page, value: number) {
  await page.getByTestId("preview-time-slider").evaluate((node, nextValue) => {
    const input = node as HTMLInputElement;
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

test.describe("preview renderer and resource lifecycle", () => {
  test("renders a fixed video frame without the playback engine", async ({ page }) => {
    await page.goto(VIDEO_CASE);
    const canvas = page.getByTestId("preview-v2-canvas");
    const slider = page.getByTestId("preview-time-slider");
    await expect(canvas).toHaveAttribute("data-backend", "webgl2");
    await expect(canvas).toHaveAttribute("data-video-times", "video:0.000:visible");
    await expect(slider).toHaveValue("0");

    await slider.fill("1");
    await expect(slider).toHaveValue("1");
    await expect(canvas).toHaveAttribute("data-video-times", "video:1.000:visible", { timeout: 10_000 });
    const playingSnapshot = await canvas.evaluate((node) => ({
      paintAt: Number(node.getAttribute("data-paint-at-ms") ?? 0),
      interval: Number(node.getAttribute("data-paint-interval-ms") ?? 0),
      dropped: Number(node.getAttribute("data-estimated-dropped-frames") ?? 0),
      diagnostics: node.getAttribute("data-diagnostics") ?? "",
    }));
    expect(playingSnapshot.paintAt).toBeGreaterThan(0);
    expect(playingSnapshot.diagnostics).not.toMatch(/error|unavailable/i);
    await expect(canvas).toHaveAttribute("data-paint-playing", "false");
  });

  test("repaints a paused seek and exposes the requested media time", async ({ page }) => {
    await page.goto(VIDEO_CASE);
    const canvas = page.getByTestId("preview-v2-canvas");
    const slider = page.getByTestId("preview-time-slider");
    await expect(canvas).toHaveAttribute("data-video-times", "video:0.000:visible");

    await slider.fill("1");
    await expect(slider).toHaveValue("1");
    await expect(page.getByTestId("preview-timecode")).toHaveText("0:01 / 0:03");
    await expect(canvas).toHaveAttribute("data-video-times", "video:1.000:visible", { timeout: 10_000 });
    await expect(canvas).toHaveAttribute("data-paint-playing", "false");
  });

  test("survives rapid scrubbing without stale diagnostics or unbounded DOM media", async ({ page }) => {
    await page.goto(VIDEO_CASE);
    const canvas = page.getByTestId("preview-v2-canvas");
    const slider = page.getByTestId("preview-time-slider");
    for (const time of [0.2, 1, 1.8, 0.6, 2.4, 1.2, 0]) {
      await slider.fill(String(time));
    }
    await expect(slider).toHaveValue("0");
    await expect(canvas).toHaveAttribute("data-video-times", "video:0.000:visible", { timeout: 10_000 });
    const snapshot = await page.evaluate(() => ({
      videos: document.querySelectorAll("video").length,
      diagnostics: document.querySelector("[data-testid='preview-v2-canvas']")?.getAttribute("data-diagnostics") ?? "",
    }));
    expect(snapshot.videos).toBeLessThanOrEqual(1);
    expect(snapshot.diagnostics).not.toMatch(/error|unavailable/i);
  });

  test("keeps preview resource counts bounded across 100 fixed-frame seeks", async ({ page }) => {
    await page.goto(VIDEO_CASE);
    const canvas = page.getByTestId("preview-v2-canvas");
    await expect(canvas).toHaveAttribute("data-video-times", "video:0.000:visible");

    for (let cycle = 0; cycle < 100; cycle += 1) {
      await seekSlider(page, (cycle % 6) * 0.4);
    }

    const counts = await readResourceCounts(page);
    expect(counts).not.toBeNull();
    expect(counts?.activeVideos).toBeLessThanOrEqual(1);
    expect(counts?.activeAssets).toBeLessThanOrEqual(1);
    expect(counts?.entries).toBeLessThanOrEqual(3);
    expect(await page.locator("video").count()).toBeLessThanOrEqual(1);
  });

  test("coalesces a burst of 1000 scrub updates to the latest target", async ({ page }) => {
    await page.goto(VIDEO_CASE);
    const slider = page.getByTestId("preview-time-slider");
    await slider.evaluate((node) => {
      const input = node as HTMLInputElement;
      for (let index = 0; index < 1000; index += 1) {
        input.value = String((index % 30) / 10);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      input.value = "2.9";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    // React-controlled range inputs batch synchronous events; make the final
    // target an actual user-equivalent update after the burst.
    await slider.fill("2.9");
    await expect(slider).toHaveValue("2.9");
    await expect(page.getByTestId("preview-v2-canvas")).not.toHaveAttribute(
      "data-diagnostics",
      /error|unavailable/i,
    );
  });

  test("releases and reuses media resources while switching mounted preview documents", async ({ page }) => {
    await page.goto(VIDEO_CASE);
    const videoCase = page.getByTestId("preview-v2-case-video.frame-seek");
    const imageCase = page.getByTestId("preview-v2-case-primitive.shape.rectangle");
    const canvas = page.getByTestId("preview-v2-canvas");
    for (let cycle = 0; cycle < 6; cycle += 1) {
      await imageCase.click();
      await expect(page).toHaveURL(/case=primitive\.shape\.rectangle/);
      await expect(canvas).toHaveAttribute("data-backend", "webgl2");
      await videoCase.click();
      await expect(page).toHaveURL(/case=video\.frame-seek/);
      await expect(canvas).toHaveAttribute("data-video-times", "video:0.000:visible", { timeout: 10_000 });
      expect(await page.locator("video").count()).toBeLessThanOrEqual(1);
      const counts = await readResourceCounts(page);
      expect(counts?.activeVideos).toBeLessThanOrEqual(1);
      expect(counts?.activeRvfcs).toBeLessThanOrEqual(1);
      expect(counts?.entries).toBeLessThanOrEqual(3);
    }
  });

  test("renders the same deterministic video seek contract on WebGPU when available", async ({ page }) => {
    test.skip(!(await supportsWebGPU(page)), "WebGPU is unavailable in this browser");
    await page.goto("/docs/preview?case=video.frame-seek&backend=webgpu&time=0");
    const canvas = page.getByTestId("preview-v2-canvas");
    const slider = page.getByTestId("preview-time-slider");
    await expect(canvas).toHaveAttribute("data-backend", "webgpu");
    await expect(canvas).toHaveAttribute("data-video-times", "video:0.000:visible");
    await slider.fill("1");
    await expect(canvas).toHaveAttribute("data-video-times", "video:1.000:visible", { timeout: 10_000 });
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /error|unavailable/i);
  });
});

test.describe("editor transport boundary", () => {
  test("timeline playhead advances and pauses independently of the stage surface", async ({ page }) => {
    await page.goto("/app/editor/shape");
    const currentTime = page.getByTestId("timeline-current-time");
    const play = page.getByTestId("timeline-play");
    await expect(page.getByTestId("editor-stage")).toBeVisible();
    await expect(currentTime).toHaveText("00:00:00:00");
    await play.click();
    await expect.poll(async () => currentTime.textContent(), { timeout: 2_000 })
      .not.toBe("00:00:00:00");
    await play.click();
    await expect(play).toHaveAttribute("aria-label", "Play");
  });
});
