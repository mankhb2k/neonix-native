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
  });
});
