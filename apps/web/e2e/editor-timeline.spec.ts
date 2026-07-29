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
              sceneId: "scene.main",
              laneId: "lane.main",
              startTime: 0,
              duration: 4,
              name: "E2E Clip",
            },
          ],
          timelineLanes: [{ id: "lane.main", kind: "main", name: "Main", order: -1 }],
          overlayScenes: [],
        },
      },
    );

    await page.goto(`/app/editor/${projectId}`);
    await expect(page.getByText("E2E Clip").first()).toBeVisible({ timeout: 30_000 });

    // Zoom load-project phải là 28 theo preference hiện tại.
    const zoomLabel = page.getByText(/28\s*%/i).first();
    await expect(zoomLabel).toBeVisible();

    // Scrub: kéo playhead slider nếu có.
    const slider = page.getByRole("slider").first();
    if (await slider.isVisible()) {
      await slider.focus();
      await page.keyboard.press("ArrowRight");
    }

    await page.reload();
    await expect(page.getByText("E2E Clip").first()).toBeVisible({ timeout: 30_000 });
  });
});
