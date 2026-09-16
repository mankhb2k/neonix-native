import { expect, test } from "@playwright/test";

test("dashboard settings link opens the profile settings page", async ({ page }) => {
  await page.goto("/dashboard");

  const settingsLink = page.getByRole("link", { name: "Settings" });
  await expect(settingsLink).toHaveAttribute("href", "/settings");
  await settingsLink.click();

  await expect(page).toHaveURL(/\/settings\/?$/);
  await expect(page.getByTestId("settings-page")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  const securityHeading = page.getByRole("heading", { level: 2, name: "Security" });
  if (await securityHeading.count()) {
    await expect(securityHeading).toBeVisible();
    const password = page.locator("#settings-new-password");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");
  } else {
    await expect(page.getByRole("heading", { level: 2, name: /Sign in to manage your profile/i })).toBeVisible();
  }
});
