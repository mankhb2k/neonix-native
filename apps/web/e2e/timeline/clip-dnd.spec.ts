import { expect, openSeededEditor, test } from "../fixtures/editor.fixture";
import {
  buildAudioCrossLaneProject,
  buildOverlayCrossLaneProject,
} from "../fixtures/project-builders";

test.describe("timeline cross-lane DnD", () => {
  test("overlay: move, reverse, source lane persists, reload", async ({
    page,
  }) => {
    const projectId = "e2e.timeline.overlay-dnd";
    const stored = buildOverlayCrossLaneProject(projectId);
    const editor = await openSeededEditor(page, projectId, stored);

    await expect(editor.clip("clip.ov")).toBeVisible({ timeout: 30_000 });
    await editor.expectClipInLane("clip.ov", "lane.overlay.0");

    await editor.dragClipToLane("clip.ov", "lane.overlay.1");
    await editor.expectLaneExists("lane.overlay.0");

    await editor.dragClipToLane("clip.ov", "lane.overlay.0");
    await editor.expectLaneExists("lane.overlay.1");
    await editor.expectStoredClipLane(projectId, "clip.ov", "lane.overlay.0");
    await editor.expectStoredLane(projectId, "lane.overlay.1");

    await editor.reload();
    await expect(editor.clip("clip.ov")).toBeVisible({ timeout: 30_000 });
    await editor.expectClipInLane("clip.ov", "lane.overlay.0");
    await editor.expectLaneExists("lane.overlay.1");
  });

  test("audio: move, reverse, source lane persists, reload", async ({
    page,
  }) => {
    const projectId = "e2e.timeline.audio-dnd";
    const stored = buildAudioCrossLaneProject(projectId);
    const editor = await openSeededEditor(page, projectId, stored);

    await expect(editor.clip("a0")).toBeVisible({ timeout: 30_000 });
    await editor.expectClipInLane("a0", "lane.audio.0");

    await editor.dragClipToLane("a0", "lane.audio.1");
    await editor.expectLaneExists("lane.audio.0");

    await editor.dragClipToLane("a0", "lane.audio.0");
    await editor.expectLaneExists("lane.audio.1");
    await editor.expectStoredClipLane(projectId, "a0", "lane.audio.0");
    await editor.expectStoredLane(projectId, "lane.audio.1");

    await editor.reload();
    await expect(editor.clip("a0")).toBeVisible({ timeout: 30_000 });
    await editor.expectClipInLane("a0", "lane.audio.0");
    await editor.expectLaneExists("lane.audio.1");
  });
});
