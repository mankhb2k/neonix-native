import { expect, openSeededEditor, test } from "../fixtures/editor.fixture";
import {
  buildAudioCrossLaneProject,
  buildOverlayCrossLaneProject,
} from "../fixtures/project-builders";

test.describe("timeline cross-lane DnD", () => {
  test("audio: drag below the last audio lane creates a lower lane", async ({
    page,
  }) => {
    const projectId = "e2e.timeline.audio-insert-below";
    const stored = buildAudioCrossLaneProject(projectId);
    const editor = await openSeededEditor(page, projectId, stored);
    const clip = editor.clip("a0");
    const lastLane = editor.lane("lane.audio.1");
    await expect(clip).toBeVisible({ timeout: 30_000 });
    const clipBox = await clip.boundingBox();
    const lastLaneBox = await lastLane.boundingBox();
    if (!clipBox || !lastLaneBox) throw new Error("missing audio drag boxes");

    const startX = clipBox.x + Math.min(24, clipBox.width / 2);
    const startY = clipBox.y + clipBox.height / 2;
    const targetX = lastLaneBox.x + 136;
    const targetY = lastLaneBox.y + lastLaneBox.height + 24;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 8, startY + 8, { steps: 4 });
    await page.mouse.move(targetX, targetY, { steps: 20 });

    const indicator = page.getByTestId("timeline-insert-indicator");
    await expect(indicator).toHaveAttribute("data-drop-family", "audio");
    const indicatorBox = await indicator.boundingBox();
    if (!indicatorBox) throw new Error("missing audio insert indicator");
    expect(indicatorBox.y).toBeGreaterThanOrEqual(
      lastLaneBox.y + lastLaneBox.height - 2,
    );

    await page.mouse.up();
    await expect(clip).toBeVisible();
    const movedLaneId = await clip.getAttribute("data-lane-id");
    expect(movedLaneId).toBeTruthy();
    expect(movedLaneId).not.toBe("lane.audio.0");
    expect(movedLaneId).not.toBe("lane.audio.1");
    await editor.expectLaneRemoved("lane.audio.0");
    await expect(
      page.locator('[data-track-lane][data-track-type="audio"]'),
    ).toHaveCount(2);
    const existingClipBox = await editor.clip("a1").boundingBox();
    const movedClipBox = await clip.boundingBox();
    if (!existingClipBox || !movedClipBox) {
      throw new Error("missing audio clip boxes after drop");
    }
    expect(movedClipBox.y).toBeGreaterThan(existingClipBox.y);
  });

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
