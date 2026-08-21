import { expect, test } from "@playwright/test";

test.describe("web V2 smoke", () => {
  test("marketing home on :3000", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
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
    await expect(page.getByText("Protocol V2 editor")).toBeVisible();
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();
    await expect(
      page.getByRole("slider", { name: "Editor time" }),
    ).toBeVisible();
    await expect(page.getByText("Atomic Protocol V2")).toBeVisible();
  });
});
