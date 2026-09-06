import { expect, test } from "@playwright/test";

test.describe("Canvas text editing", () => {
  test("selects on first click and enters edit mode on double click", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    const titleHitbox = page.locator('[data-layer-hit="chapter-1-title"]');
    await expect(titleHitbox).toBeVisible();

    await titleHitbox.click();
    await expect(page.getByTestId("stage-selection-bounds")).toBeVisible();
    await expect(page.getByTestId("stage-text-edit-input")).toHaveCount(0);

    await page.getByTestId("stage-selection-bounds").dblclick();
    await expect(page.getByTestId("stage-text-edit-overlay")).toBeVisible();
    await expect(page.getByTestId("stage-text-edit-input")).toHaveCount(1);
    await expect(page.getByTestId("stage-text-edit-hitbox")).toBeVisible();
  });

  test("blinks the canvas caret without rerendering the stage", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    const titleHitbox = page.locator('[data-layer-hit="chapter-1-title"]');
    await expect(titleHitbox).toBeVisible();
    await titleHitbox.click();
    await expect(page.getByTestId("stage-selection-bounds")).toBeVisible();
    await page.getByTestId("stage-selection-bounds").dblclick();

    const overlay = page.getByTestId("stage-text-edit-overlay");
    const initialBlinkCount = Number(await overlay.getAttribute("data-caret-blink") ?? "0");
    await expect.poll(
      async () => Number(await overlay.getAttribute("data-caret-blink") ?? "0"),
      { timeout: 2_000, intervals: [100] },
    ).toBeGreaterThan(initialBlinkCount);

    await page.keyboard.press("Escape");
  });

  test("commits one text edit and Escape restores the draft", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    const titleHitbox = page.locator('[data-layer-hit="chapter-1-title"]');
    await titleHitbox.click();
    const textField = page.getByRole("textbox", { name: "Text", exact: true });
    const original = await textField.inputValue();

    await page.getByTestId("stage-selection-bounds").dblclick();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("Edited from stage");
    await expect(textField).toHaveValue("Edited from stage");
    await page.keyboard.press("Escape");
    await expect(textField).toHaveValue(original);

    await page.getByTestId("stage-selection-bounds").dblclick();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("Committed from stage");
    await page.keyboard.press("Enter");
    await expect(textField).toHaveValue("Committed from stage");
    await expect(page.getByTestId("stage-text-edit-overlay")).toHaveCount(0);

    const undo = page.getByRole("button", { name: "Undo", exact: true });
    await expect(undo).toBeEnabled();
    await undo.click();
    await expect(textField).toHaveValue(original);
  });

  test("keeps the text edit input focused for caret typing", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    await page.locator('[data-layer-hit="chapter-1-title"]').click();
    await page.getByTestId("stage-selection-bounds").dblclick();
    const textField = page.getByRole("textbox", { name: "Text", exact: true });
    const original = await textField.inputValue();

    await page.keyboard.press("End");
    await page.keyboard.type("!");
    await expect(textField).toHaveValue(`${original}!`);
    await page.keyboard.press("Escape");
  });
});
