import { expect, test } from "@playwright/test";

test.describe("HTML compiler two-panel preview layout", () => {
  test("shows native CSS beside the compiled Protocol V2 preview", async ({ page }) => {
    await page.goto("/docs/preview/html-compiler");

    await expect(page.getByTestId("html-compiler-runtime-lab")).toBeVisible();
    await expect(page.getByTestId("html-compiler-sidebar")).toBeVisible();
    await expect(page.getByTestId("html-compiler-two-panel")).toBeVisible();
    await expect(page.getByTestId("html-compiler-browser-stage").locator("iframe")).toBeVisible();
    await expect(page.getByTestId("html-compiler-runtime-stage")).toBeVisible();
    await expect(page.getByText("Cascade + value normalization")).toBeVisible();
    await expect(page.getByText("Normalized Protocol V2")).toBeVisible();
    await expect(page.getByTestId("html-compiler-runtime-canvas")).toBeVisible();
    await expect(page.getByTestId("html-compiler-browser-transport")).toBeVisible();
    await expect(page.getByTestId("html-compiler-browser-play-toggle")).toBeVisible();
    const toggle = page.getByTestId("html-compiler-skia-play-toggle");
    const time = page.getByTestId("html-compiler-skia-preview-time");
    await expect(toggle).toBeVisible();
    await expect(time).toHaveAttribute("data-time", "0.000000");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-label", "Pause preview");
    await expect(page.getByTestId("html-compiler-browser-play-toggle")).toHaveAttribute("aria-label", "Pause preview");
    const browserPlayback = await page.getByTestId("html-compiler-browser-stage").locator("iframe").evaluate((iframe) => iframe.contentDocument?.documentElement.dataset.neonixPlayback);
    expect(browserPlayback).toBe("running");
    await expect.poll(async () => Number(await time.getAttribute("data-time"))).toBeGreaterThan(0.05);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-label", "Play preview");
    await expect(page.getByTestId("html-compiler-browser-play-toggle")).toHaveAttribute("aria-label", "Play preview");
  });
});
