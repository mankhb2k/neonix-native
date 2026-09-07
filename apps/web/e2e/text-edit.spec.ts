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

  test("double-click does not add a line before Shift+Enter", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    const titleHitbox = page.locator('[data-layer-hit="chapter-1-title"]');
    await titleHitbox.click();
    const selection = page.getByTestId("stage-selection-bounds");

    await selection.dblclick();
    const editHitbox = page.getByTestId("stage-text-edit-hitbox");
    await expect(editHitbox).toBeVisible();
    const before = await editHitbox.boundingBox();
    if (!before) throw new Error("text edit hitbox is not visible");
    await page.waitForTimeout(700);
    const after = await editHitbox.boundingBox();
    if (!after) throw new Error("text edit hitbox is not visible");
    expect(Math.abs(after.height - before.height)).toBeLessThan(3);

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

  test("places the caret at the end when clicking the right side of the text box", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    const titleHitbox = page.locator('[data-layer-hit="chapter-1-title"]');
    await expect(titleHitbox).toBeVisible();
    await titleHitbox.click();
    await expect(page.getByTestId("stage-selection-bounds")).toBeVisible();
    const selection = page.getByTestId("stage-selection-bounds");
    const textField = page.getByRole("textbox", { name: "Text", exact: true });
    await expect(textField).toBeVisible();
    const original = await textField.inputValue();

    await selection.dblclick();
    const hitbox = page.getByTestId("stage-text-edit-hitbox");
    await expect(hitbox).toBeVisible();
    await page.waitForTimeout(700);
    const box = await hitbox.boundingBox();
    if (!box) throw new Error("text edit hitbox is not visible");
    // The stage is CSS-scaled, so use viewport coordinates instead of
    // locator position (which is relative to the unscaled layout box).
    await page.mouse.click(box.x + box.width - 4, box.y + box.height / 2);
    await page.keyboard.type("!");

    await expect(textField).toHaveValue(`${original}!`);
    await page.keyboard.press("Escape");
  });

  test("Shift+Enter inserts a line break and grows the frame downward", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    await page.locator('[data-layer-hit="chapter-1-title"]').click();
    await page.getByTestId("stage-selection-bounds").dblclick();
    await expect(page.getByTestId("stage-text-edit-input")).toBeFocused();

    const hitbox = page.getByTestId("stage-text-edit-hitbox");
    const textField = page.getByRole("textbox", { name: "Text", exact: true });
    const before = await hitbox.boundingBox();
    expect(before).not.toBeNull();

    await page.keyboard.press("Control+A");
    await page.keyboard.type("First line");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("Second line");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("Third line");

    await expect(textField).toHaveValue("First line\nSecond line\nThird line");
    await expect.poll(
      async () => (await hitbox.boundingBox())?.height ?? 0,
      { timeout: 5_000 },
    ).toBeGreaterThan(before?.height ?? 0);
    await expect.poll(
      async () => (await hitbox.boundingBox())?.y ?? 0,
      { timeout: 5_000 },
    ).toBeCloseTo(before?.y ?? 0, 0);

    await page.keyboard.press("Escape");
  });

  test("deleting a multiline draft keeps text ranges valid", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    await page.locator('[data-layer-hit="chapter-1-title"]').click();
    await page.getByTestId("stage-selection-bounds").dblclick();

    const textField = page.getByRole("textbox", { name: "Text", exact: true });
    await page.keyboard.press("Control+A");
    await page.keyboard.type("First line");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("Second line");
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await expect(textField).toHaveValue("");
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("inspector-properties").getByRole("alert")).toHaveCount(0);
  });

  test("deleting text from the inspector keeps text ranges valid", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    await page.locator('[data-layer-hit="chapter-1-title"]').click();

    const textField = page.getByRole("textbox", { name: "Text", exact: true });
    await textField.fill("");
    await page.getByRole("button", { name: "Layout", exact: true }).last().click();

    await expect(page.getByTestId("inspector-properties").getByRole("alert")).toHaveCount(0);
    await expect(textField).toHaveValue("");
  });
});
