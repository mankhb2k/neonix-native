import { expect, test } from "@playwright/test";

test("dashboard settings link opens the profile settings page", async ({ page }) => {
  await page.goto("/dashboard");

  const settingsLink = page.getByRole("link", { name: "Settings" });
  await expect(settingsLink).toHaveAttribute("href", "/settings");
  await settingsLink.click();

  await expect(page).toHaveURL(/\/settings\/?$/);
  await expect(page.getByTestId("settings-page")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(
    page
      .getByRole("heading", { level: 2, name: "Security" })
      .or(page.getByRole("heading", { level: 2, name: /Sign in to manage your profile/i })),
  ).toBeVisible();
});
