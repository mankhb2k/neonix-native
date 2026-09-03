import { expect, test } from "@playwright/test";

test.describe("Skia Phase 7 default preview backend", () => {
  test("uses Skia for the implicit and auto preview paths", async ({ page }) => {
    await page.goto("/docs/preview?case=primitive.shape.rectangle");
    const canvas = page.getByTestId("preview-v2-canvas");

    await expect(canvas).toHaveAttribute("data-backend", "skia", { timeout: 30_000 });
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    await expect(page.getByTestId("preview-active-backend")).toHaveText("Active: Skia");
    await expect(canvas).not.toHaveAttribute("data-diagnostics", /backend_unavailable|preview_renderer_error/);
  });

  test("keeps legacy GPU backends available only when explicitly requested", async ({ page }) => {
    await page.goto("/docs/preview?case=primitive.shape.rectangle&backend=webgl2");
    const canvas = page.getByTestId("preview-v2-canvas");

    await expect(canvas).toHaveAttribute("data-backend", "webgl2", { timeout: 30_000 });
    await expect(canvas).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
  });
});
