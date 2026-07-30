import { expect, test } from "@playwright/test";

/**
 * Editor timeline regression flow (Phase 0 baseline).
 * Seed localStorage rồi mở editor — không phụ thuộc modal tạo project.
 */
test.describe("editor timeline persistence flow", () => {
  test("load project → zoom 28 → scrub → reload keeps document", async ({ page }) => {
    const projectId = "e2e.editor.persistence";
    const project = {
      format: "motion-project",
      formatVersion: 2,
      metadata: {
        id: projectId,
        name: "E2E Editor",
        aspectRatio: "16:9",
        fps: 30,
        locale: "vi-VN",
        brand: { name: "E2E", primaryColor: "#1A5D3A" },
      },
      dependencies: { components: [] },
      assets: [],
      variables: [],
      timeline: { sceneOrder: ["scene.main"], audioTracks: [] },
      scenes: [
        {
          id: "scene.main",
          duration: 4,
          nodes: [
            {
              id: "node.title",
              type: "text",
              parentId: null,
              transform: {
                x: 40,
                y: 40,
                width: 200,
                height: 40,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                anchorX: 0,
                anchorY: 0,
                opacity: 1,
                visible: true,
                flipX: false,
                flipY: false,
              },
              payload: { text: "E2E Clip", fontSize: 24, fontWeight: 600, align: "left" },
              style: { fill: "#111111" },
            },
          ],
          clips: [],
        },
      ],
      bindings: [],
      extensions: { constraints: [], events: [] },
    };

    await page.addInitScript(
      ({ id, stored }) => {
        window.localStorage.setItem("motionvideo.projects", JSON.stringify({ [id]: stored }));
      },
      {
        id: projectId,
        stored: {
          storageVersion: 1,
          savedAt: new Date().toISOString(),
          project,
          timelineClips: [
            {
              id: "clip.main",
              kind: "scene",
              sceneId: "scene.main",
              laneId: "lane.main",
              startTime: 0,
              duration: 4,
              name: "E2E Clip",
            },
          ],
          timelineLanes: [
            {
              id: "lane.main",
              kind: "visual",
              role: "base",
              name: "Main",
              order: -1,
              policy: { allowOverlap: false, rippleMode: false },
            },
          ],
          overlayScenes: [],
        },
      },
    );

    await page.goto(`/app/editor/${projectId}`);
    await expect(page.getByText("E2E Clip").first()).toBeVisible({ timeout: 30_000 });

    // Zoom load-project phải là 28 theo preference hiện tại.
    const zoomSlider = page.getByRole("slider", { name: /zoom timeline/i });
    await expect(zoomSlider).toHaveValue("28");

    // Preview compose layers attribute present after bake-parity preview path.
    await expect(page.getByTestId("runtime-preview-canvas")).toBeVisible({
      timeout: 15_000,
    });

    // Scrub: Playhead slider must exist; assert aria-valuenow + timecode move.
    const playhead = page.getByRole("slider", { name: "Playhead" });
    await expect(playhead).toBeVisible();
    const before = Number(await playhead.getAttribute("aria-valuenow"));
    const timecode = page.getByTestId("timeline-current-time");
    const beforeTc = await timecode.textContent();
    await playhead.focus();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => Number(await playhead.getAttribute("aria-valuenow")))
      .toBeGreaterThan(before);
    await expect(timecode).not.toHaveText(beforeTc ?? "");

    await page.reload();
    await expect(page.getByText("E2E Clip").first()).toBeVisible({ timeout: 30_000 });
    await expect(zoomSlider).toHaveValue("28");
  });

  test("drag overlay clip to another overlay lane", async ({ page }) => {
    const projectId = "e2e.editor.crosslane";
    const textNode = (id: string, text: string) => ({
      id,
      type: "text" as const,
      parentId: null,
      transform: {
        x: 40,
        y: 40,
        width: 200,
        height: 40,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        anchorX: 0,
        anchorY: 0,
        opacity: 1,
        visible: true,
        flipX: false,
        flipY: false,
      },
      payload: { text, fontSize: 24, fontWeight: 600, align: "left" as const },
      style: { fill: "#111111" },
    });

    const project = {
      format: "motion-project",
      formatVersion: 2,
      metadata: {
        id: projectId,
        name: "E2E Cross Lane",
        aspectRatio: "16:9",
        fps: 30,
        locale: "vi-VN",
        brand: { name: "E2E", primaryColor: "#1A5D3A" },
      },
      dependencies: { components: [] },
      assets: [],
      variables: [],
      timeline: {
        sceneOrder: ["scene.main", "scene.ov", "scene.ov2"],
        audioTracks: [],
      },
      scenes: [
        {
          id: "scene.main",
          duration: 4,
          nodes: [textNode("node.main", "Main")],
          clips: [],
        },
        {
          id: "scene.ov",
          duration: 2,
          nodes: [textNode("node.ov", "OvClip")],
          clips: [],
        },
        {
          id: "scene.ov2",
          duration: 1,
          nodes: [textNode("node.ov2", "DestClip")],
          clips: [],
        },
      ],
      bindings: [],
      extensions: { constraints: [], events: [] },
    };

    await page.addInitScript(
      ({ id, stored }) => {
        window.localStorage.setItem(
          "motionvideo.projects",
          JSON.stringify({ [id]: stored }),
        );
      },
      {
        id: projectId,
        stored: {
          storageVersion: 1,
          savedAt: new Date().toISOString(),
          project,
          timelineClips: [
            {
              id: "clip.main",
              kind: "scene",
              sceneId: "scene.main",
              laneId: "lane.main",
              startTime: 0,
              duration: 4,
              name: "MainClip",
            },
            {
              id: "clip.ov",
              kind: "scene",
              sceneId: "scene.ov",
              laneId: "lane.overlay.0",
              startTime: 0,
              duration: 2,
              name: "OvClip",
            },
            {
              id: "clip.dest",
              kind: "scene",
              sceneId: "scene.ov2",
              laneId: "lane.overlay.1",
              startTime: 3,
              duration: 1,
              name: "DestClip",
            },
          ],
          timelineLanes: [
            {
              id: "lane.main",
              kind: "visual",
              role: "base",
              name: "Main",
              order: -1,
              policy: { allowOverlap: false, rippleMode: false },
            },
            {
              id: "lane.overlay.0",
              kind: "visual",
              role: "overlay",
              name: "Lớp 1",
              order: 0,
              policy: { allowOverlap: false, rippleMode: false },
            },
            {
              id: "lane.overlay.1",
              kind: "visual",
              role: "overlay",
              name: "Lớp 2",
              order: 1,
              policy: { allowOverlap: false, rippleMode: false },
            },
          ],
          overlayScenes: [],
        },
      },
    );

    await page.goto(`/app/editor/${projectId}`);
    const ovClip = page.locator('[data-clip-id="clip.ov"]');
    await expect(ovClip).toBeVisible({ timeout: 30_000 });
    await expect(ovClip).toHaveAttribute("data-lane-id", "lane.overlay.0");

    const destLane = page.locator(
      '[data-track-lane][data-lane-id="lane.overlay.1"]',
    );
    await expect(destLane).toBeVisible();

    const clipBox = await ovClip.boundingBox();
    const destBox = await destLane.boundingBox();
    if (!clipBox || !destBox) throw new Error("missing clip/lane boxes");

    await page.mouse.move(
      clipBox.x + Math.min(24, clipBox.width / 2),
      clipBox.y + clipBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(destBox.x + 48, destBox.y + destBox.height / 2, {
      steps: 12,
    });
    await page.mouse.up();

    await expect(
      page.locator('[data-clip-id="clip.ov"][data-lane-id="lane.overlay.1"]'),
    ).toBeVisible({ timeout: 10_000 });
  });
});
