import { expect, openSeededEditor, test } from "../fixtures/editor.fixture";
import {
  buildAudioCrossLaneProject,
  buildOverlayCrossLaneProject,
} from "../fixtures/project-builders";

test.describe("timeline cross-lane DnD", () => {
  test("overlay: move to dest lane, empty source lane removed, reload", async ({
    page,
  }) => {
    const projectId = "e2e.timeline.overlay-dnd";
    const stored = buildOverlayCrossLaneProject(projectId);
    const editor = await openSeededEditor(page, projectId, stored);

    await expect(editor.clip("clip.ov")).toBeVisible({ timeout: 30_000 });
    await editor.expectClipInLane("clip.ov", "lane.overlay.0");

    // Move clip from overlay.0 → overlay.1: source lane.overlay.0 should be removed.
    await editor.dragClipToLane("clip.ov", "lane.overlay.1");
    await editor.expectLaneRemoved("lane.overlay.0");
    // Destination lane still exists with the clip.
    await editor.expectLaneExists("lane.overlay.1");
    await editor.expectClipInLane("clip.ov", "lane.overlay.1");
    await editor.expectStoredClipLane(projectId, "clip.ov", "lane.overlay.1");

    await editor.reload();
    await expect(editor.clip("clip.ov")).toBeVisible({ timeout: 30_000 });
    await editor.expectClipInLane("clip.ov", "lane.overlay.1");
    // Source lane is still gone after reload.
    await editor.expectLaneRemoved("lane.overlay.0");
  });

  test("audio: move to dest lane, empty source lane removed, reload", async ({
    page,
  }) => {
    const projectId = "e2e.timeline.audio-dnd";
    const stored = buildAudioCrossLaneProject(projectId);
    const editor = await openSeededEditor(page, projectId, stored);

    await expect(editor.clip("a0")).toBeVisible({ timeout: 30_000 });
    await editor.expectClipInLane("a0", "lane.audio.0");

    // Move clip from audio.0 → audio.1: source lane.audio.0 should be removed.
    await editor.dragClipToLane("a0", "lane.audio.1");
    await editor.expectLaneRemoved("lane.audio.0");
    // Destination lane still exists with the clip.
    await editor.expectLaneExists("lane.audio.1");
    await editor.expectClipInLane("a0", "lane.audio.1");
    await editor.expectStoredClipLane(projectId, "a0", "lane.audio.1");

    await editor.reload();
    await expect(editor.clip("a0")).toBeVisible({ timeout: 30_000 });
    await editor.expectClipInLane("a0", "lane.audio.1");
    // Source lane is still gone after reload.
    await editor.expectLaneRemoved("lane.audio.0");
  });
});
