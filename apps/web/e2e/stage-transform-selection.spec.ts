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

  test("resizes a selected shape from the east handle", async ({ page }) => {
    await page.goto("/app/editor/shape");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();

    await page.locator('[data-layer-hit="shape"]').click();
    const widthInput = page.getByRole("spinbutton", { name: "Width", exact: true });
    await expect(widthInput).toHaveValue("960");

    const handle = page.locator('[data-testid="stage-selection-bounds"] [data-handle="e"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error("east resize handle is not visible");
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 12, centerY);
    await page.mouse.up();

    await expect(widthInput).not.toHaveValue("960");
  });

  test("routes clicks through a selected full-canvas media layer", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();

    await page.locator('[data-layer-id="historical-atmosphere"]').click();
    await expect(page.locator('[data-layer-id="historical-atmosphere"]')).toHaveClass(
      /border-\[var\(--accent\)\]/,
    );

    // The title is above the full-canvas media layer. Its hitbox coordinate
    // is intentionally clicked while the media selection bounds is active.
    const titleHitbox = page.locator('[data-layer-hit="chapter-1-title"]');
    const titleBox = await titleHitbox.boundingBox();
    if (!titleBox) throw new Error("chapter title hitbox is not visible");
    await page.mouse.click(
      titleBox.x + titleBox.width / 2,
      titleBox.y + titleBox.height / 2,
    );
    await expect(page.locator('[data-layer-id="chapter-1-title"]')).toHaveClass(
      /border-\[var\(--accent\)\]/,
    );
  });
});
