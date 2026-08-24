import { expect, test } from "@playwright/test";

test.describe("V2 preview layer hit testing", () => {
  test("selects the highest-order overlapping layer", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();

    // At t=0 the chapter card and title overlap exactly. The title has the
    // higher order and must own the hit area in the preview.
    const titleHitbox = page.locator('[data-layer-hit="chapter-1-title"]');
    await expect(titleHitbox).toBeVisible();
    await titleHitbox.click();

    await expect(page.locator('[data-layer-id="chapter-1-title"]')).toHaveClass(
      /border-\[var\(--accent\)\]/,
    );
    await expect(page.getByTestId("stage-selection-bounds")).toBeVisible();
  });
});

