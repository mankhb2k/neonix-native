import { expect, test } from "./fixtures/editor.fixture";
import { STORAGE_KEY } from "./fixtures/project-builders";
import { EditorPage } from "./pages/editor.page";
import { createDemoMotionProject } from "@motionvideo/motion-runtime/testing";
import type { Page } from "@playwright/test";

function buildBlitSeed(projectId: string) {
  const demo = createDemoMotionProject();
  const project = {
    ...demo,
    metadata: { ...demo.metadata, id: projectId, name: "E2E Clip" },
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
        duration: 3,
        name: "E2E Clip",
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

async function clickTestId(page: Page, testId: string) {
  await page.evaluate((id) => {
    const el = document.querySelector(
      `[data-testid="${id}"]`,
    ) as HTMLButtonElement | null;
    el?.click();
  }, testId);
}

test.describe("preview blit dual-path", () => {
  test("drag stays on Pixi live; play shows blit; pause returns to Pixi", async ({
    page,
  }) => {
    const projectId = "e2e.preview.blit-dual";
    const stored = buildBlitSeed(projectId);
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
    await editor.goto(projectId, "stage=blit");
    await expect(page.getByTestId("editor-shell")).toBeVisible({
      timeout: 30_000,
    });
    await editor.waitReady("E2E Clip");

    const stage = page.getByTestId("editor-stage");
    await expect(stage).toHaveAttribute("data-stage-backend", "blit");

    const surfaces = page.getByTestId("preview-stage-surfaces");
    const pixiCanvas = page.getByTestId("runtime-preview-canvas");
    const blitCanvas = page.getByTestId("runtime-preview-blit-canvas");
    await expect(pixiCanvas).toBeVisible();
    await expect(blitCanvas).toBeHidden();
    await expect(surfaces).toHaveAttribute("data-preview-mode", "live");

    const overlay = page.getByTestId("interaction-overlay");
    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + 40, box!.y + 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + 72, box!.y + 56, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.press("Escape");
    await expect(pixiCanvas).toBeVisible();
    await expect(blitCanvas).toBeHidden();

    await clickTestId(page, "timeline-play");
    await expect(page.getByTestId("timeline-play")).toHaveAttribute(
      "aria-label",
      "Pause",
    );
    await expect(surfaces).toHaveAttribute("data-preview-mode", "buffered");
    await expect(blitCanvas).toBeVisible({ timeout: 15_000 });
    await expect(pixiCanvas).toBeHidden();

    await clickTestId(page, "timeline-play");
    await expect(page.getByTestId("timeline-play")).toHaveAttribute(
      "aria-label",
      "Play",
    );
    await expect(surfaces).toHaveAttribute("data-preview-mode", "live");
    await expect(pixiCanvas).toBeVisible();
    await expect(blitCanvas).toBeHidden();

    const currentTime = page.getByTestId("timeline-current-time");
    const beforeTc = await currentTime.textContent();
    const ruler = page.getByTestId("timeline-ruler");
    await expect(ruler).toBeVisible();
    const rulerBox = await ruler.boundingBox();
    expect(rulerBox).toBeTruthy();
    await page.mouse.click(
      rulerBox!.x + Math.min(200, rulerBox!.width * 0.4),
      rulerBox!.y + rulerBox!.height / 2,
    );
    await expect(currentTime).not.toHaveText(beforeTc ?? "");
    await expect(pixiCanvas).toBeVisible();
    await expect(surfaces).toHaveAttribute("data-preview-mode", "live");
  });
});
