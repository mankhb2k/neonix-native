import { expect, openSeededEditor, test } from "../fixtures/editor.fixture";
import {
  buildMainOnlyProject,
  buildOverlayCrossLaneProject,
} from "../fixtures/project-builders";

test.describe("timeline persistence", () => {
  test("zoom-on-load 28 and document survive reload", async ({ page }) => {
    const projectId = "e2e.timeline.persist-zoom";
    const editor = await openSeededEditor(
      page,
      projectId,
      buildMainOnlyProject(projectId),
    );
    await editor.waitReady("E2E Clip");

    const zoomSlider = page.getByRole("slider", { name: /zoom timeline/i });
    await expect(zoomSlider).toHaveValue("28");

    await editor.reload();
    await editor.waitReady("E2E Clip");
    await expect(zoomSlider).toHaveValue("28");
  });

  test("empty source lane after overlay move survives reload", async ({
    page,
  }) => {
    const projectId = "e2e.timeline.persist-empty-lane";
    const editor = await openSeededEditor(
      page,
      projectId,
      buildOverlayCrossLaneProject(projectId),
    );

    await expect(editor.clip("clip.ov")).toBeVisible({ timeout: 30_000 });
    await editor.dragClipToLane("clip.ov", "lane.overlay.1");
    await editor.expectLaneExists("lane.overlay.0");
    await editor.expectStoredClipLane(
      projectId,
      "clip.ov",
      "lane.overlay.1",
    );
    await editor.expectStoredLane(projectId, "lane.overlay.0");

    await editor.reload();
    await expect(editor.clip("clip.ov")).toBeVisible({ timeout: 30_000 });
    await editor.expectClipInLane("clip.ov", "lane.overlay.1");
    await editor.expectLaneExists("lane.overlay.0");
  });
});
