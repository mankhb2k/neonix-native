import { expect, test } from "@playwright/test";

test.describe("web smoke", () => {
  test("marketing home on :3000", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("workspace hub loads at /app", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/TVC motion/i);
    await expect(page.getByRole("button", { name: /Tạo dự án mới/i })).toBeVisible();
  });
});
