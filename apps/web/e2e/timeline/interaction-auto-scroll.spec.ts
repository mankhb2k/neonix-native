import { expect, openSeededEditor, test } from "../fixtures/editor.fixture";
import { buildScrollableAudioProject } from "../fixtures/project-builders";

test.describe("timeline interaction auto-scroll", () => {
  test("sidebar audio drag reaches the lane below a scrollable stack", async ({
    page,
  }) => {
    const projectId = "e2e.timeline.sidebar-auto-scroll";
    const editor = await openSeededEditor(
      page,
      projectId,
      buildScrollableAudioProject(projectId),
    );
    await expect(editor.clip("audio.0")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Âm thanh" }).first().click();

    const source = page
      .locator('[draggable="true"]')
      .filter({ hasText: "Colors Of Life" })
      .first();
    const scrollRoot = page.getByTestId("timeline-tracks-scroll");
    await expect(source).toBeVisible();
    const sourceBox = await source.boundingBox();
    const rootBox = await scrollRoot.boundingBox();
    if (!sourceBox || !rootBox) throw new Error("missing sidebar drag boxes");

    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(rootBox.x + 320, rootBox.y + rootBox.height - 4, {
      steps: 24,
    });
    await expect
      .poll(() =>
        scrollRoot.evaluate(
          (element) =>
            element.scrollTop >=
            element.scrollHeight - element.clientHeight - 2,
        ),
      )
      .toBe(true);
    await expect(page.getByTestId("timeline-insert-indicator")).toHaveAttribute(
      "data-drop-family",
      "audio",
    );
    await page.mouse.up();
    await expect(
      page.locator("[data-clip-id]").filter({ hasText: "Colors Of Life" }),
    ).toBeVisible();
  });

  test("clip move scrolls to lanes below the initial viewport", async ({
    page,
  }) => {
    const projectId = "e2e.timeline.clip-auto-scroll";
    const editor = await openSeededEditor(
      page,
      projectId,
      buildScrollableAudioProject(projectId),
    );
    const clip = editor.clip("audio.0");
    const scrollRoot = page.getByTestId("timeline-tracks-scroll");
    await expect(clip).toBeVisible({ timeout: 30_000 });

    const clipBox = await clip.boundingBox();
    const rootBox = await scrollRoot.boundingBox();
    if (!clipBox || !rootBox) throw new Error("missing auto-scroll boxes");

    const startX = clipBox.x + Math.min(18, clipBox.width / 2);
    const startY = clipBox.y + clipBox.height / 2;
    const edgeX = rootBox.x + Math.min(320, rootBox.width / 2);
    const edgeY = rootBox.y + rootBox.height - 4;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 8, startY + 8, { steps: 4 });
    await page.mouse.move(edgeX, edgeY, { steps: 16 });

    await expect
      .poll(() =>
        scrollRoot.evaluate(
          (element) =>
            element.scrollTop >=
            element.scrollHeight - element.clientHeight - 2,
        ),
      )
      .toBe(true);
    await expect(editor.lane("lane.audio.7")).toBeVisible();
    await expect(page.getByTestId("timeline-insert-indicator")).toHaveAttribute(
      "data-drop-family",
      "audio",
    );
    await page.mouse.up();
  });

  test("marquee keeps selecting in content coordinates while wheel scrolling", async ({
    page,
  }) => {
    const projectId = "e2e.timeline.marquee-auto-scroll";
    const editor = await openSeededEditor(
      page,
      projectId,
      buildScrollableAudioProject(projectId),
    );
    const mainLane = editor.lane("lane.main");
    const lastClip = editor.clip("audio.7");
    const scrollRoot = page.getByTestId("timeline-tracks-scroll");
    await expect(mainLane).toBeVisible({ timeout: 30_000 });

    const mainBox = await mainLane.boundingBox();
    const rootBox = await scrollRoot.boundingBox();
    if (!mainBox || !rootBox) throw new Error("missing marquee boxes");

    const startX = rootBox.x + Math.min(520, rootBox.width - 80);
    const startY = mainBox.y + mainBox.height / 2;
    const edgeX = rootBox.x + 112;
    const wheelY = rootBox.y + rootBox.height - 60;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(edgeX, wheelY, { steps: 20 });
    await page.mouse.wheel(0, 2_000);

    await expect
      .poll(() =>
        scrollRoot.evaluate(
          (element) =>
            element.scrollTop >=
            element.scrollHeight - element.clientHeight - 2,
        ),
      )
      .toBe(true);
    await expect(lastClip).toBeVisible();
    await page.mouse.up();
    await expect(lastClip).toHaveClass(/border-2/);
  });

  test("marquee vertical auto-scroll stops at the bottom-most track lane", async ({
    page,
  }) => {
    const projectId = "e2e.timeline.marquee-vertical-bound";
    const editor = await openSeededEditor(
      page,
      projectId,
      buildScrollableAudioProject(projectId),
    );
    const mainLane = editor.lane("lane.main");
    const scrollRoot = page.getByTestId("timeline-tracks-scroll");
    await expect(mainLane).toBeVisible({ timeout: 30_000 });

    const mainBox = await mainLane.boundingBox();
    const rootBox = await scrollRoot.boundingBox();
    if (!mainBox || !rootBox) throw new Error("missing marquee boxes");

    const startX = rootBox.x + 200;
    const startY = mainBox.y + mainBox.height / 2;
    const farBottomY = rootBox.y + rootBox.height + 100;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, farBottomY, { steps: 20 });

    await page.waitForTimeout(300);

    const actualScrollTop = await scrollRoot.evaluate(
      (element) => element.scrollTop,
    );
    const maxTrackScrollTop = await page.evaluate(() => {
      const scrollEl = document.querySelector(
        "[data-testid='timeline-tracks-scroll']",
      );
      const lanes = document.querySelectorAll("[data-track-lane='true']");
      if (!scrollEl || lanes.length === 0) return 0;
      const lastLane = lanes[lanes.length - 1];
      const rootRect = scrollEl.getBoundingClientRect();
      const lastLaneRect = lastLane.getBoundingClientRect();
      const lastLaneBottomInScrollContent =
        lastLaneRect.bottom - rootRect.top + scrollEl.scrollTop;
      return Math.max(
        0,
        lastLaneBottomInScrollContent + 16 - scrollEl.clientHeight,
      );
    });

    expect(actualScrollTop).toBeLessThanOrEqual(maxTrackScrollTop + 2);
    await page.mouse.up();
  });
});
