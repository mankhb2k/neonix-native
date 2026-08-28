import { expect, test } from "@playwright/test";

const AUDIO_CASES = [
  "audio.asset",
  "audio.timing",
  "audio.trim",
  "audio.gain",
  "audio.pan",
  "audio.fade",
  "audio.track.mute",
  "audio.track.overlap",
  "audio.video-source",
  "audio.mix.two-tracks",
  "audio.mix.video-plus-music",
] as const;

test.describe("Protocol V2 audio fixture preview", () => {
  test("serves the local MP3 fixture through the docs audio endpoint", async ({ request }) => {
    const response = await request.get("/api/docs/audio");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("audio/mpeg");
    expect(Number(response.headers()["content-length"])).toBeGreaterThan(1000000);
  });

  test("shows one contract preview for every Phase 2 audio capability", async ({ page }) => {
    for (const caseId of AUDIO_CASES) {
      await page.goto(`/docs/preview?case=${caseId}`);
      await expect(page.getByTestId("audio-fixture-preview")).toBeVisible();
      await expect(page.getByTestId("audio-fixture-element")).toHaveAttribute(
        "src",
        /\/api\/docs\/audio|\/docs\/example-video\.mp4/,
      );
      await expect(page.getByTestId("preview-v2-error")).toHaveCount(0);
    }
  });

  test("shows clip duration and source trim range separately from the full asset", async ({ page }) => {
    await page.goto("/docs/preview?case=audio.trim");
    await expect(page.getByTestId("audio-clip-transport")).toBeVisible();
    await expect(page.getByTestId("audio-clip-time-slider")).toHaveAttribute("max", "5");
    await expect(page.getByTestId("audio-clip-transport")).toContainText("Source range: 0:08 - 0:14 of 2:04");

    await page.goto("/docs/preview?case=audio.fade");
    const fadeSlider = page.getByTestId("audio-clip-time-slider");
    const fadeAudio = page.getByTestId("audio-fixture-element");
    await expect(fadeSlider).toHaveAttribute("max", "20");
    await expect(fadeAudio).toHaveAttribute("data-audio-backend", "web-audio-v2");
    await expect(page.getByTestId("audio-clip-transport")).toContainText("Source range: 0:52 - 1:12 of 2:04");
    await expect(page.getByTestId("audio-fixture-tracks")).toContainText("fade in 4s / out 4s");
    await fadeSlider.fill("0");
    await expect(fadeAudio).toHaveJSProperty("volume", 0);
    await fadeSlider.fill("4");
    await expect(fadeAudio).toHaveJSProperty("volume", 1);
    await fadeSlider.fill("20");
    await expect(fadeAudio).toHaveJSProperty("volume", 0);
  });

  test("uses the same custom transport for the full audio asset", async ({ page }) => {
    await page.goto("/docs/preview?case=audio.asset");
    await expect(page.getByTestId("audio-clip-transport")).toBeVisible();
    await expect(page.getByTestId("audio-clip-time-slider")).toHaveAttribute("max", "124.551837");
    await expect(page.getByTestId("audio-clip-transport")).toContainText("Source range: 0:00 - 2:04 of 2:04");
  });

  test("uses deliberately strong gain and pan values over ten seconds", async ({ page }) => {
    await page.goto("/docs/preview?case=audio.gain");
    await expect(page.getByTestId("audio-clip-time-slider")).toHaveAttribute("max", "10");
    await expect(page.getByTestId("audio-fixture-tracks")).toContainText("gain -6 dB / pan 0 / active");
    await expect(page.getByTestId("audio-fixture-tracks")).toContainText("gain -6 dB, total -12 dB");
    await page.goto("/docs/preview?case=audio.pan");
    await expect(page.getByTestId("audio-clip-time-slider")).toHaveAttribute("max", "10");
    await expect(page.getByTestId("audio-fixture-tracks")).toContainText("gain 0 dB / pan 1 / active");
    await page.goto("/docs/preview?case=audio.video-source");
    await expect(page.getByTestId("audio-clip-time-slider")).toHaveAttribute("max", "10");
    await expect(page.getByTestId("audio-clip-transport")).toContainText("Source range: 0:00 - 0:10 of 1:00");
    await page.goto("/docs/preview?case=audio.track.mute");
    await expect(page.getByTestId("audio-fixture-tracks")).toContainText("muted");
    await expect(page.getByTestId("audio-clip-transport")).toContainText("Track output: muted");
    await expect(page.getByTestId("audio-fixture-element")).toHaveJSProperty("muted", true);
  });

  test("keeps the V2 transport aligned through play, pause, and seek", async ({ page }) => {
    await page.goto("/docs/preview?case=audio.trim");
    const toggle = page.getByTestId("audio-clip-play-toggle");
    const slider = page.getByTestId("audio-clip-time-slider");

    await expect(toggle).toHaveAttribute("aria-label", "Play audio clip");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-label", "Pause audio clip");

    await slider.fill("4");
    await expect(slider).toHaveValue("4");
    await expect(page.getByTestId("audio-clip-transport")).toContainText("0:04 / 0:05");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-label", "Play audio clip");
  });
});
