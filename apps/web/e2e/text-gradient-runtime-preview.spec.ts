import { expect, test } from "@playwright/test";

test.describe("text gradient Runtime / PaintCommandBuffer / CanvasKit preview", () => {
  test("keeps the canonical gradient paint on the text command", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto("/docs/preview/native", { waitUntil: "load" });
    await page.selectOption("#runtime-skia-case", "text.linear-gradient");

    const lab = page.getByTestId("skia-runtime-lab");
    await expect(page.locator("canvas").first()).toHaveAttribute("data-runtime-text-commands", "1", { timeout: 45_000 });
    await expect(lab).toHaveAttribute("data-text-fill-paint", "linear-gradient", { timeout: 45_000 });
    await expect(page.getByTestId("skia-runtime-stage")).toBeVisible();
    await expect(page.locator("canvas").first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
