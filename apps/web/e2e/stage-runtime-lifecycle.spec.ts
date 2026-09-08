import { expect, test } from "@playwright/test";

async function openShapeEditor(page: import("@playwright/test").Page) {
  await page.goto("/app/editor/shape");
  await expect(page.getByTestId("preview-v2-stage")).toBeVisible();
  const hitbox = page.locator('[data-layer-hit="shape"]');
  await expect(hitbox).toBeVisible();
  await hitbox.click();
  await expect(page.getByTestId("stage-selection-bounds")).toBeVisible();
}

async function dragSelection(
  page: import("@playwright/test").Page,
  deltaX: number,
  deltaY = 0,
) {
  const selection = page.getByTestId("stage-selection-bounds");
  const box = await selection.boundingBox();
  if (!box) throw new Error("stage selection bounds are not measurable");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY);
  return { selection, box };
}

function layerIds(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

test.describe("stage runtime and transform lifecycle", () => {
  test("routes a pointer move through preview first and commits on pointerup", async ({ page }) => {
    await openShapeEditor(page);

    const xInput = page.getByRole("spinbutton", { name: "X", exact: true });
    const initialX = await xInput.inputValue();
    const { selection, box } = await dragSelection(page, 24, 12);

    await expect.poll(async () => (await selection.boundingBox())?.x ?? box.x)
      .toBeGreaterThan(box.x + 8);
    // The preview changes stage chrome, not the canonical inspector value.
    await expect(xInput).toHaveValue(initialX);

    await page.mouse.up();
    await expect.poll(async () => xInput.inputValue()).not.toBe(initialX);
  });

  test("cancels a pointer preview without committing the document", async ({ page }) => {
    await openShapeEditor(page);

    const xInput = page.getByRole("spinbutton", { name: "X", exact: true });
    const initialX = await xInput.inputValue();
    const { selection, box } = await dragSelection(page, 28, 14);

    await expect.poll(async () => (await selection.boundingBox())?.x ?? box.x)
      .toBeGreaterThan(box.x + 8);
    await page.keyboard.press("Escape");
    await page.mouse.up();

    await expect(xInput).toHaveValue(initialX);
    await expect.poll(async () => (await selection.boundingBox())?.x ?? box.x)
      .toBeCloseTo(box.x, 0);
  });

  test("keeps runtime snapshot layer ids consistent with stage hitboxes after seeking", async ({ page }) => {
    await page.goto("/app/editor/three-kingdoms");
    await expect(page.getByTestId("preview-v2-stage")).toBeVisible();

    const snapshot = page.getByTestId("stage-runtime-snapshot");
    const ruler = page.getByTestId("timeline-ruler");
    await expect(snapshot).toHaveAttribute("data-document-id", "history-three-kingdoms-60s");

    const assertSnapshotMatchesHitboxes = async () => {
      const expected = layerIds(await snapshot.getAttribute("data-active-layer-ids"));
      const actual = await page.locator("[data-layer-hit]").evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-layer-hit") ?? ""),
      );
      expect(actual.sort()).toEqual(expected.sort());
    };

    await assertSnapshotMatchesHitboxes();
    const initialTime = await snapshot.getAttribute("data-time");
    const rulerBox = await ruler.boundingBox();
    if (!rulerBox) throw new Error("timeline ruler is not measurable");

    await page.mouse.click(rulerBox.x + rulerBox.width * 0.5, rulerBox.y + rulerBox.height / 2);
    await expect.poll(async () => snapshot.getAttribute("data-time"), { timeout: 5_000 })
      .not.toBe(initialTime);
    await assertSnapshotMatchesHitboxes();
  });
});
