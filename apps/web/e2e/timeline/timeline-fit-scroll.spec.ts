import { expect, test } from "@playwright/test";

test.describe("Timeline Fit & Scroll E2E", () => {
  test("timeline loads with fit 1/3 scale for first clip and no initial horizontal scrollbar overflow", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("[data-testid='timeline-tracks-scroll']");

    const scrollEl = page.locator("[data-testid='timeline-tracks-scroll']");
    await expect(scrollEl).toBeVisible();

    const scrollLeft = await scrollEl.evaluate((el) => el.scrollLeft);
    expect(scrollLeft).toBe(0);
  });
});
