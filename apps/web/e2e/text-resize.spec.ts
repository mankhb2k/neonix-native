import { expect, test, type Page } from "@playwright/test";

async function selectTitle(page: Page) {
  const titleHitbox = page.locator('[data-layer-hit="chapter-1-title"]');
  await expect(titleHitbox).toBeVisible();
  await titleHitbox.click();
  const selection = page.getByTestId("stage-selection-bounds");
  await expect(selection).toBeVisible();
  await expect.poll(async () => (await selection.boundingBox())?.width ?? Number.POSITIVE_INFINITY)
    .toBeLessThan(250);
}

async function dragHandle(
  page: Page,
  handleName: string,
  deltaX: number,
  deltaY = 0,
) {
  const handle = page.locator(
    `[data-testid="stage-selection-bounds"] [data-handle="${handleName}"]`,
  );
  const box = await handle.boundingBox();
  if (!box) throw new Error(`${handleName} resize handle is not visible`);
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY);
  await page.mouse.up();
}

test.describe("Canva-style text resizing", () => {
  test.describe.configure({ mode: "serial" });

  test("keeps side handles and restores the four corner scale handles", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();
    await selectTitle(page);

    for (const handle of ["nw", "ne", "sw", "se", "e", "w"]) {
      await expect(
        page.locator(`[data-testid="stage-selection-bounds"] [data-handle="${handle}"]`),
      ).toHaveCount(1);
    }
    for (const handle of ["n", "s"]) {
      await expect(
        page.locator(`[data-testid="stage-selection-bounds"] [data-handle="${handle}"]`),
      ).toHaveCount(0);
    }
  });

  test("scales font size and frame from a corner", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();
    await selectTitle(page);

    const fontSize = page.getByRole("spinbutton", { name: "Font size", exact: true });
    const selection = page.getByTestId("stage-selection-bounds");
    const initialSelection = await selection.boundingBox();
    if (!initialSelection) throw new Error("text selection bounds are not measurable");
    const initialFontSize = Number(await fontSize.inputValue());

    await dragHandle(page, "se", 28, 18);

    await expect.poll(async () => Number(await fontSize.inputValue())).toBeGreaterThan(initialFontSize);
    await expect.poll(async () => (await selection.boundingBox())?.width ?? 0)
      .toBeGreaterThan(initialSelection.width);
  });

  test("wraps text when the side handle is pulled inward and grows the frame height", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();
    await selectTitle(page);
    const zoomIn = page.getByRole("button", { name: "Zoom in preview", exact: true });
    await zoomIn.click();
    await zoomIn.click();
    await zoomIn.click();

    const width = page.getByRole("spinbutton", { name: "Width", exact: true });
    const selection = page.getByTestId("stage-selection-bounds");
    const initialSelection = await selection.boundingBox();
    if (!initialSelection) throw new Error("text selection bounds are not measurable");

    await dragHandle(page, "e", -35);

    await expect.poll(async () => Number(await width.inputValue())).toBeLessThan(1440);
    await expect.poll(async () => (await selection.boundingBox())?.height ?? 0)
      .toBeGreaterThan(initialSelection.height);
    await expect(page.getByText("Auto", { exact: true })).toBeVisible();
  });

  test("keeps the custom resize cursor during pointer capture", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();
    await selectTitle(page);

    const zoomIn = page.getByRole("button", { name: "Zoom in preview", exact: true });
    await zoomIn.click();
    await zoomIn.click();
    await zoomIn.click();

    const handle = page.locator('[data-testid="stage-selection-bounds"] [data-handle="se"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error("se resize handle is not visible");
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 18, startY + 12);
    await expect.poll(async () =>
      page.evaluate(() => document.documentElement.style.cursor),
    ).toContain("resize-diagonal-nw-se.svg");
    await page.mouse.up();
    await expect.poll(async () =>
      page.evaluate(() => document.documentElement.style.cursor),
    ).toBe("");
  });
});
