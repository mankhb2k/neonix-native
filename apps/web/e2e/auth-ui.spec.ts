import { expect, test } from "@playwright/test";

test.describe("auth UI", () => {
  for (const [path, heading] of [
    ["/login", "Welcome back"],
    ["/register", "Create your account"],
  ] as const) {
    test(`${path} uses the Neonix auth design`, async ({ page }) => {
      await page.goto(path);

      const authCard = page.getByTestId("auth-card");
      await expect(authCard).toBeVisible();
      expect((await authCard.boundingBox())?.width ?? 0).toBeGreaterThan(1000);
      await expect(page.locator('img[src="/neonix-logo.svg"]').first()).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.locator("#auth-email")).toBeVisible();
      await expect(page.locator("#auth-email")).toHaveClass(/hover:border-\[#65c4ed\]/);
      await expect(page.getByRole("button", { name: /Google/i })).toBeVisible();
    });
  }
});
