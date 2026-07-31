import { expect, openSeededEditor, test } from "../fixtures/editor.fixture";
import { buildMainOnlyProject } from "../fixtures/project-builders";

test.describe("timeline playback", () => {
  test("scrub updates playhead aria, timecode, and transform", async ({
    page,
  }) => {
    const projectId = "e2e.timeline.playback-scrub";
    const editor = await openSeededEditor(
      page,
      projectId,
      buildMainOnlyProject(projectId),
    );
    await editor.waitReady("E2E Clip");

    const playhead = editor.playhead();
    await expect(playhead).toBeVisible();
    const before = Number(await playhead.getAttribute("aria-valuenow"));
    const beforeTc = await editor.currentTime().textContent();
    const beforeTransform = await editor.playheadTransform();

    await editor.scrubPlayheadByKeyboard(8);

    await expect
      .poll(async () => Number(await playhead.getAttribute("aria-valuenow")))
      .toBeGreaterThan(before + 0.1);
    await expect(editor.currentTime()).not.toHaveText(beforeTc ?? "");
    await expect
      .poll(async () => editor.playheadTransform())
      .not.toBe(beforeTransform);
  });

  test("keyboard frame seek and play/pause advance time", async ({ page }) => {
    const projectId = "e2e.timeline.playback-transport";
    const editor = await openSeededEditor(
      page,
      projectId,
      buildMainOnlyProject(projectId),
    );
    await editor.waitReady("E2E Clip");

    const playhead = editor.playhead();
    await playhead.focus();
    const t0 = Number(await playhead.getAttribute("aria-valuenow"));
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => Number(await playhead.getAttribute("aria-valuenow")))
      .toBeGreaterThan(t0);

    await page.getByRole("button", { name: "Play" }).click();
    const playingAt = Number(await playhead.getAttribute("aria-valuenow"));
    await expect
      .poll(async () => Number(await playhead.getAttribute("aria-valuenow")), {
        timeout: 5_000,
      })
      .toBeGreaterThan(playingAt);

    await page.getByRole("button", { name: "Pause" }).click();
    const pausedAt = Number(await playhead.getAttribute("aria-valuenow"));
    await page.waitForTimeout(300);
    const still = Number(await playhead.getAttribute("aria-valuenow"));
    expect(Math.abs(still - pausedAt)).toBeLessThan(0.05);
  });
});
