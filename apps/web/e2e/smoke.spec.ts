import { expect, test } from "@playwright/test";

test.describe("web V2 smoke", () => {
  test("marketing home on :3000", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Create Neon Motion Videos from JSON, Audio, and AI/i,
      }),
    ).toBeVisible();
  });

  test("workspace hub exposes certified V2 editors", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /motion atom/i,
    );
    await expect(
      page.getByRole("link", { name: /V2 shape editor/i }),
    ).toBeVisible();
  });

  test("V2 editor renders certified shape and transport", async ({ page }) => {
    await page.goto("/app/editor/shape");
    await expect(page.getByTestId("editor-shell")).toBeVisible();
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();
    await expect(
      page.getByRole("slider", { name: "Playhead" }),
    ).toBeVisible();
    await expect(page.getByTestId("layers-panel")).toContainText("Protocol V2");
    await expect(page.getByTestId("editor-timeline")).toBeVisible();
    await expect(page.getByTestId("timeline-clip-shape")).toBeVisible();

    const currentTime = page.getByTestId("timeline-current-time");
    await page.getByRole("button", { name: "Play" }).click();
    await expect(currentTime).not.toHaveText("00:00:00:00", { timeout: 1000 });
    await page.getByTestId("timeline-clip-shape").click();
    await expect(page.getByTestId("timeline-clip-shape")).toHaveClass(/ring-1/);
  });
});
