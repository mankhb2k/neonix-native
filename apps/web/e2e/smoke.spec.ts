import { expect, test } from "@playwright/test";

test.describe("web smoke", () => {
  test("marketing home on :3000", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("AI workspace hub loads at /appai", async ({ page }) => {
    await page.goto("/appai");
    await expect(page).toHaveURL(/\/appai\/?$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/brief|motion video/i);
    await expect(page.getByRole("link", { name: /Tạo video mới/i })).toBeVisible();
  });

  test("new project brief form is reachable", async ({ page }) => {
    await page.goto("/appai/projects/new");
    await expect(page.getByRole("button", { name: /Tạo bản nháp bằng AI/i })).toBeVisible();
  });

  test("brief submit creates local draft and opens review", async ({ page }) => {
    await page.goto("/appai/projects/new");
    await page.getByPlaceholder(/Ra mắt cà phê/i).fill("E2E Coffee Launch");
    await page.getByPlaceholder(/cold brew/i).fill("Video 20 giây giới thiệu cold brew mát lạnh và CTA đặt hàng.");
    await page.getByRole("button", { name: /Tạo bản nháp bằng AI/i }).click();
    await expect(page).toHaveURL(/\/appai\/projects\/draft-\d+/);
    await expect(page.getByText("E2E Coffee Launch")).toBeVisible();
    await expect(page.getByText(/Đã lưu cục bộ/i)).toBeVisible();
    const stored = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((entry) => entry.startsWith("motionvideo.renew.draft-"));
      return key ? localStorage.getItem(key) : null;
    });
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toMatchObject({
      name: "E2E Coffee Launch",
      ratio: "9:16",
    });
  });
});
