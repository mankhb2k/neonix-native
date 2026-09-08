import { expect, test, type Locator, type Page } from "@playwright/test";

async function openEditor(page: Page, path = "/app/editor/shape") {
  await page.goto(path);
  await expect(page.getByTestId("editor-shell")).toBeVisible();
  await expect(page.getByTestId("timeline-viewport")).toBeVisible();
}

async function dragFromLocator(
  page: Page,
  locator: Locator,
  deltaX: number,
  deltaY = 0,
) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("timeline target is not measurable");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY);
  return box;
}

async function selectShapeClip(page: Page) {
  const clip = page.getByTestId("timeline-clip-shape");
  await expect(clip).toBeVisible();
  await clip.click();
  await expect(clip).toHaveClass(/ring-1/);
  return clip;
}

test.describe("timeline playback and edit lifecycle", () => {
  test("playhead seek updates playback time and the timeline playhead", async ({ page }) => {
    await openEditor(page);

    const ruler = page.getByTestId("timeline-ruler");
    const currentTime = page.getByTestId("timeline-current-time");
    const playhead = page.getByTestId("timeline-playhead");
    const initial = await currentTime.textContent();
    const rulerBox = await ruler.boundingBox();
    if (!rulerBox) throw new Error("timeline ruler is not measurable");

    await page.mouse.click(
      rulerBox.x + rulerBox.width * 0.55,
      rulerBox.y + rulerBox.height / 2,
    );

    await expect.poll(() => currentTime.textContent()).not.toBe(initial);
    await expect.poll(async () => Number(await playhead.getAttribute("data-playhead-time")))
      .toBeGreaterThan(0);
  });

  test("timeline duration is supplied by the playback port", async ({ page }) => {
    await openEditor(page);

    const duration = page.getByTestId("timeline-duration");
    await expect(duration).toHaveAttribute("data-duration-source", "playback");
    await expect.poll(async () => Number(await duration.getAttribute("data-duration-seconds")))
      .toBeGreaterThan(0);
  });

  test("clip move exposes preview, commits on pointerup, and cancels on Escape", async ({ page }) => {
    await openEditor(page);
    const clip = await selectShapeClip(page);
    const initialBox = await clip.boundingBox();
    if (!initialBox) throw new Error("selected clip is not measurable");

    await dragFromLocator(page, clip, 32);
    await expect(page.getByTestId("timeline-clip-move-ghost")).toBeVisible();
    await expect(clip).toHaveCSS("visibility", "hidden");
    await page.mouse.up();
    await expect.poll(async () => (await clip.boundingBox())?.x ?? initialBox.x)
      .toBeGreaterThan(initialBox.x + 8);

    await openEditor(page);
    const cancelClip = await selectShapeClip(page);
    const cancelInitialBox = await cancelClip.boundingBox();
    if (!cancelInitialBox) throw new Error("selected clip is not measurable");
    await dragFromLocator(page, cancelClip, 32);
    await expect(page.getByTestId("timeline-clip-move-ghost")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.mouse.up();

    await expect(page.getByTestId("timeline-clip-move-ghost")).toHaveCount(0);
    await expect.poll(async () => (await cancelClip.boundingBox())?.x ?? cancelInitialBox.x)
      .toBeCloseTo(cancelInitialBox.x, 0);
  });

  test("trim exposes a local preview and commits the resolved duration", async ({ page }) => {
    await openEditor(page);
    const clip = await selectShapeClip(page);
    const trimRight = page.getByTestId("timeline-clip-trim-right");
    await expect(trimRight).toBeVisible();
    const initialBox = await clip.boundingBox();
    if (!initialBox) throw new Error("selected clip is not measurable");

    const handleBox = await trimRight.boundingBox();
    if (!handleBox) throw new Error("trim handle is not measurable");
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 32, startY);

    await expect.poll(async () => (await clip.boundingBox())?.width ?? initialBox.width)
      .toBeGreaterThan(initialBox.width + 10);
    await page.mouse.up();
    await expect.poll(async () => (await clip.boundingBox())?.width ?? initialBox.width)
      .toBeGreaterThan(initialBox.width + 10);
  });

  test("marquee selection previews while dragging and commits selected clips", async ({ page }) => {
    await openEditor(page, "/app/editor/three-kingdoms");
    const canvas = page.getByTestId("timeline-track-canvas");
    const clip = page.getByTestId("timeline-clip-main-lane");
    await expect(clip).toBeVisible();
    const canvasBox = await canvas.boundingBox();
    const clipBox = await clip.boundingBox();
    if (!canvasBox || !clipBox) throw new Error("timeline marquee targets are not measurable");

    const startX = Math.max(canvasBox.x + 8, clipBox.x + 8);
    const startY = Math.min(canvasBox.y + 10, clipBox.y - 8);
    const endX = clipBox.x + clipBox.width * 0.55;
    const endY = clipBox.y + clipBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY);

    await expect(page.getByTestId("timeline-marquee")).toBeVisible();
    await page.mouse.up();
    await expect.poll(async () => Number(await page.getByTestId("editor-timeline").getAttribute("data-selected-clip-count")))
      .toBeGreaterThan(0);
  });

  test("stage snapshot and timeline playhead publish one current time", async ({ page }) => {
    await openEditor(page, "/app/editor/three-kingdoms");
    const snapshot = page.getByTestId("stage-runtime-snapshot");
    const ruler = page.getByTestId("timeline-ruler");
    const playhead = page.getByTestId("timeline-playhead");
    const rulerBox = await ruler.boundingBox();
    if (!rulerBox) throw new Error("timeline ruler is not measurable");

    await page.mouse.click(
      rulerBox.x + rulerBox.width * 0.4,
      rulerBox.y + rulerBox.height / 2,
    );
    await expect.poll(async () => Number(await snapshot.getAttribute("data-time")))
      .toBeGreaterThan(0);
    await expect.poll(async () => {
      const stageTime = Number(await snapshot.getAttribute("data-time"));
      const playheadTime = Number(await playhead.getAttribute("data-playhead-time"));
      return Math.abs(stageTime - playheadTime);
    }).toBeLessThan(0.05);
  });
});
