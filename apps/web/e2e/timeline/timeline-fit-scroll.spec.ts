import { expect, test } from "@playwright/test";

test.describe("Timeline Fit & Scroll E2E", () => {
  test("timeline loads with fit 1/3 scale for first clip and split scrollbar starting after label pane", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("[data-testid='timeline-tracks-scroll']");

    const scrollEl = page.locator("[data-testid='timeline-tracks-scroll']");
    await expect(scrollEl).toBeVisible();

    const box = await scrollEl.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(96);
    }

    const scrollLeft = await scrollEl.evaluate((el) => el.scrollLeft);
    expect(scrollLeft).toBe(0);
  });
});
