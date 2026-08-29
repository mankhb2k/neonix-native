import { expect, test } from "@playwright/test";

test.describe("preview audio contract", () => {
  test("shows AudioMixPlan topology without coupling docs preview to Playback", async ({ page }) => {
    await page.goto("/docs/preview?case=audio.mix.video-plus-music");
    await expect(page.getByTestId("audio-fixture-preview")).toBeVisible();
    await expect(page.getByTestId("audio-mix-topology")).toContainText("2 independent inputs");
    await expect(page.getByTestId("audio-fixture-element")).toHaveAttribute(
      "data-audio-backend",
      "native-audition",
    );
    await expect(page.getByTestId("audio-clip-play-toggle")).toHaveCount(0);
  });
});
