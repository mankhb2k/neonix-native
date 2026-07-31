import { expect, openSeededEditor, test } from "./fixtures/editor.fixture";
import {
  buildMainOnlyProject,
  buildOverlayCrossLaneProject,
} from "./fixtures/project-builders";

/**
 * Editor timeline regression flow (Phase 0 baseline).
 * Prefer harness builders — avoid addInitScript so reload keeps autosave.
 */
test.describe("editor timeline persistence flow", () => {
  test("load project → zoom 28 → scrub → reload keeps document", async ({
    page,
  }) => {
    const projectId = "e2e.editor.persistence";
    const editor = await openSeededEditor(
      page,
      projectId,
      buildMainOnlyProject(projectId),
    );
    await editor.waitReady("E2E Clip");

    const zoomSlider = page.getByRole("slider", { name: /zoom timeline/i });
    await expect(zoomSlider).toHaveValue("28");

    await expect(page.getByTestId("runtime-preview-canvas")).toBeVisible({
      timeout: 15_000,
    });

    const playhead = editor.playhead();
    await expect(playhead).toBeVisible();
    const before = Number(await playhead.getAttribute("aria-valuenow"));
    const timecode = editor.currentTime();
    const beforeTc = await timecode.textContent();
    await playhead.focus();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => Number(await playhead.getAttribute("aria-valuenow")))
      .toBeGreaterThan(before);
    await expect(timecode).not.toHaveText(beforeTc ?? "");

    await editor.reload();
    await editor.waitReady("E2E Clip");
    await expect(zoomSlider).toHaveValue("28");
  });

  test("drag overlay clip to another overlay lane", async ({ page }) => {
    const projectId = "e2e.editor.crosslane";
    const editor = await openSeededEditor(
      page,
      projectId,
      buildOverlayCrossLaneProject(projectId),
    );

    await expect(editor.clip("clip.ov")).toBeVisible({ timeout: 30_000 });
    await editor.expectClipInLane("clip.ov", "lane.overlay.0");
    await editor.dragClipToLane("clip.ov", "lane.overlay.1");
    await editor.expectLaneExists("lane.overlay.0");
  });
});
