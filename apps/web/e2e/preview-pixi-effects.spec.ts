import { expect, test } from "./fixtures/editor.fixture";
import { STORAGE_KEY } from "./fixtures/project-builders";
import { EditorPage } from "./pages/editor.page";
import { createNeonEffectsPreviewProject } from "@motionvideo/motion-runtime/testing";

function buildEffectsSeed(projectId: string) {
  const demo = createNeonEffectsPreviewProject();
  const project = {
    ...demo,
    metadata: { ...demo.metadata, id: projectId, name: "E2E Effects" },
  };
  return {
    storageVersion: 2,
    savedAt: new Date().toISOString(),
    project,
    timelineClips: [
      {
        id: "clip.main",
        kind: "scene" as const,
        laneId: "lane.main",
        startTime: 0,
        duration: 2,
        name: "E2E Effects",
        sceneId: "root",
      },
    ],
    timelineLanes: [
      {
        id: "lane.main",
        kind: "visual" as const,
        role: "base" as const,
        name: "Main",
        order: -1,
        policy: { allowOverlap: false, rippleMode: false },
      },
    ],
    overlayScenes: [] as unknown[],
  };
}

test.describe("Pixi preview with inner-glow + noise", () => {
  test("editor Pixi canvas mounts a compiled effects project", async ({
    page,
  }) => {
    const projectId = "e2e.preview.pixi-effects";
    const stored = buildEffectsSeed(projectId);
    await page.addInitScript(
      ({ collectionKey, indexKey, projectKey, id, record }) => {
        window.localStorage.setItem(
          collectionKey,
          JSON.stringify({ [id]: record }),
        );
        window.localStorage.setItem(projectKey, JSON.stringify(record));
        window.localStorage.setItem(indexKey, JSON.stringify([id]));
      },
      {
        collectionKey: STORAGE_KEY,
        indexKey: "motionvideo.projectIndex",
        projectKey: `motionvideo.project.${projectId}`,
        id: projectId,
        record: stored,
      },
    );
    const editor = new EditorPage(page);
    await editor.goto(projectId, "stage=pixi");
    await expect(page.getByTestId("editor-shell")).toBeVisible({
      timeout: 30_000,
    });
    await editor.waitReady("E2E Effects");

    const stage = page.getByTestId("editor-stage");
    await expect(stage).toHaveAttribute("data-stage-backend", "pixi");
    const canvas = page.getByTestId("runtime-preview-canvas");
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const box = await canvas.boundingBox();
    expect(box?.width).toBeGreaterThan(40);
    expect(box?.height).toBeGreaterThan(40);
  });
});
