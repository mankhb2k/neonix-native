import { expect, test } from "@playwright/test";

test.describe("isolated playback integration", () => {
  test("editor play, pause, and seek use the shared playback transport", async ({ page }) => {
    await page.goto("/app/editor/shape");
    await expect(page.getByTestId("editor-shell")).toBeVisible();

    const currentTime = page.getByTestId("timeline-current-time");
    const playToggle = page.getByTestId("timeline-play");
    const initial = await currentTime.textContent();

    await playToggle.click();
    await expect(playToggle).toHaveAttribute("aria-label", "Pause");
    await expect.poll(() => currentTime.textContent()).not.toBe(initial);

    await playToggle.click();
    await expect(playToggle).toHaveAttribute("aria-label", "Play");
    const paused = await currentTime.textContent();

    const viewport = page.getByTestId("timeline-viewport");
    const box = await viewport.boundingBox();
    if (!box) throw new Error("timeline viewport is not measurable");
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.55);
    await expect.poll(() => currentTime.textContent()).not.toBe(paused);
  });

  test("editor audio creates the WebAudio playback path", async ({ page }) => {
    await page.addInitScript(() => {
      const state = { created: 0 };
      const scope = window as typeof window & { __motionAudioContextState?: typeof state };
      scope.__motionAudioContextState = state;
      const NativeAudioContext = window.AudioContext;
      if (!NativeAudioContext) return;
      window.AudioContext = class extends NativeAudioContext {
        constructor() {
          super();
          state.created += 1;
        }
      };
    });
    await page.goto("/app/editor/three-kingdoms");
    await expect(page.getByTestId("editor-shell")).toBeVisible();

    const currentTime = page.getByTestId("timeline-current-time");
    await page.getByTestId("timeline-play").click();
    await expect.poll(() => currentTime.textContent()).not.toBe("00:00:00:00");
    await expect.poll(() => page.evaluate(() => (window as typeof window & { __motionAudioContextState?: { created: number } }).__motionAudioContextState?.created ?? 0)).toBeGreaterThan(0);
  });

  test("docs Skia keeps its independent video registration path", async ({ page }) => {
    await page.goto("/docs/preview/native");
    const select = page.locator("#runtime-skia-case");
    const canvas = page.getByTestId("skia-runtime-stage");
    await select.selectOption("video.frame-seek");
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    await expect.poll(async () => {
      const raw = await canvas.getAttribute("data-preview-resource-counts");
      return Number((JSON.parse(raw ?? "{}") as { activeVideos?: number }).activeVideos ?? 0);
    }).toBeGreaterThan(0);
    await expect.poll(async () => await canvas.getAttribute("data-video-times") ?? "").toMatch(/visible/);
    await expect.poll(async () => {
      const raw = await canvas.getAttribute("data-video-health");
      const health = JSON.parse(raw ?? "[]") as Array<{ driftMs?: number }>;
      return health.length > 0 && health.every((entry) => Number.isFinite(entry.driftMs));
    }).toBe(true);
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /preview_asset_missing/);
  });
});
