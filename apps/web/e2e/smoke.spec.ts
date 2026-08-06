import { expect, test } from "@playwright/test";

test.describe("web smoke", () => {
  test("marketing home on :3000", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("workspace hub loads at /app", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /TVC motion/i,
    );
    await expect(
      page.getByRole("button", { name: /Tạo dự án mới/i }),
    ).toBeVisible();
  });

  test("editor shell with Remotion stage loads for seeded project", async ({
    page,
  }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: /Dọc 9:16/i }).click();
    await expect(page).toHaveURL(/\/app\/editor\//);
    await expect(page.getByTestId("editor-shell")).toBeVisible();
    await expect(page.getByTestId("editor-stage")).toBeVisible();
    await expect(page.getByTestId("editor-stage-frame")).toBeVisible();
    await expect(page.getByTestId("editor-timeline")).toBeVisible();
    await expect(page.getByTestId("editor-ask-ai")).toBeVisible();
    await expect(page.getByTestId("interaction-overlay")).toBeVisible();
    await expect(page.getByTestId("layer-tree")).toBeVisible();
  });
});

test.describe("editor acceptance scaffolds", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: /Ngang 16:9/i }).click();
    await expect(page.getByTestId("editor-shell")).toBeVisible();
  });

  test("A — select layer syncs inspector", async ({ page }) => {
    await page.getByRole("tab", { name: /Layers/i }).click();
    const layer = page.getByTestId("layer-row-hook.title");
    await expect(layer).toBeVisible();
    await layer.click();
    await page.getByRole("tab", { name: /^Properties$/i }).click();
    await expect(page.getByTestId("inspector-properties")).toContainText(
      /Facebook|hook\.title|text/i,
    );
    await expect(page.getByTestId("selection-bounds")).toBeVisible();
  });

  test("B — lock control is available on selection", async ({ page }) => {
    await page.getByRole("tab", { name: /Layers/i }).click();
    await page.getByTestId("layer-row-hook.title").click();
    await page.getByRole("tab", { name: /^Properties$/i }).click();
    await expect(page.getByTestId("lock-element")).toBeVisible();
    await page.getByTestId("lock-element").click();
    await expect(page.getByTestId("lock-element")).toContainText(/Locked/i);
  });

  test("timeline shows Facebook History scenes on blank preview", async ({
    page,
  }) => {
    await expect(page.getByTestId("timeline-scene-strip")).toContainText(/Hook/i);
    await expect(page.getByTestId("timeline-play")).toBeVisible();
  });

  test("D — scrub timeline, edit text, undo", async ({ page }) => {
    const strip = page.getByTestId("timeline-scene-strip");
    const box = await strip.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box!.x + box!.width * 0.15, box!.y + box!.height / 2);

    await page.getByRole("tab", { name: /Layers/i }).click();
    await page.getByTestId("layer-row-hook.title").click();
    await page.getByRole("tab", { name: /^Properties$/i }).click();

    const props = page.getByTestId("inspector-properties");
    const textarea = props.locator("textarea").first();
    await expect(textarea).toBeVisible();
    const before = await textarea.inputValue();
    await textarea.fill("Edited Facebook Title");
    await expect(textarea).toHaveValue("Edited Facebook Title");

    await page.getByTestId("editor-undo").click();
    await expect(textarea).toHaveValue(before);
  });

  test("C — Ask AI produces proposal diff", async ({ page }) => {
    await page.getByTestId("editor-ask-ai").locator("textarea").fill(
      "Make the headline punchier",
    );
    await page.getByRole("button", { name: /^Generate$/i }).click();
    await expect(page.getByTestId("ai-job-progress")).toBeVisible();
    await expect(page.getByTestId("ai-proposal-diff")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("E — export job reaches ready", async ({ page }) => {
    await page.getByTestId("export-button").click();
    await expect(page.getByRole("button", { name: /Ready/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});
