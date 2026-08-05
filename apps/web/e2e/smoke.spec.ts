import { expect, test } from "@playwright/test";

test.describe("web smoke", () => {
  test("marketing home on :3000", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("workspace hub loads at /app", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /TVC motion/i,
    );
    await expect(
      page.getByRole("button", { name: /Tạo dự án mới/i }),
    ).toBeVisible();
  });

  test("editor shell scaffold loads for seeded project", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: /Dọc 9:16/i }).click();
    await expect(page).toHaveURL(/\/app\/editor\//);
    await expect(page.getByTestId("editor-shell")).toBeVisible();
    await expect(page.getByTestId("editor-stage")).toBeVisible();
    await expect(page.getByTestId("editor-timeline")).toBeVisible();
    await expect(page.getByTestId("editor-ask-ai")).toBeVisible();
  });
});
