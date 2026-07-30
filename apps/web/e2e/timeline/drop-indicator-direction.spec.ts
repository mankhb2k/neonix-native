import { expect, openSeededEditor, test } from "../fixtures/editor.fixture";
import {
  baseLane,
  buildMainOnlyProject,
  buildStoredProject,
} from "../fixtures/project-builders";

const FRAME_LIBRARY_MIME = "application/x-motionvideo-frame";
const AUDIO_LIBRARY_MIME = "application/x-moticlip-audio";

test.describe("timeline insertion indicator direction", () => {
  test("first visual library drop always establishes Main", async ({ page }) => {
    const projectId = "e2e.timeline.first-visual-main";
    const editor = await openSeededEditor(
      page,
      projectId,
      buildStoredProject({
        projectId,
        name: "E2E First Visual Main",
        scenes: [],
        clips: [],
        lanes: [baseLane()],
      }),
    );
    const main = editor.lane("lane.main");
    await expect(main).toBeVisible({ timeout: 30_000 });
    const mainBox = await main.boundingBox();
    if (!mainBox) throw new Error("missing empty Main lane box");

    await main.evaluate(
      (element, { x, y, mime }) => {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData(mime, "mock_el_circle");
        element.dispatchEvent(
          new DragEvent("dragover", {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            dataTransfer,
          }),
        );
      },
      {
        x: mainBox.x + 160,
        // Deliberately use the blank runway above Main. Base-only policy must
        // still target Main instead of creating the first overlay lane.
        y: mainBox.y - 24,
        mime: FRAME_LIBRARY_MIME,
      },
    );

    await expect(page.getByTestId("timeline-insert-indicator")).toBeHidden();

    await main.evaluate(
      (element, { x, y, mime }) => {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData(mime, "mock_el_circle");
        element.dispatchEvent(
          new DragEvent("drop", {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            dataTransfer,
          }),
        );
      },
      {
        x: mainBox.x + 160,
        y: mainBox.y - 24,
        mime: FRAME_LIBRARY_MIME,
      },
    );

    await expect(
      page.locator('[data-clip-id][data-lane-id="lane.main"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('[data-track-lane][data-track-type="overlay"]'),
    ).toHaveCount(0);
  });

  test("visual library item shows its insertion line above Main", async ({
    page,
  }) => {
    const projectId = "e2e.timeline.visual-indicator";
    const editor = await openSeededEditor(
      page,
      projectId,
      buildMainOnlyProject(projectId),
    );
    await editor.waitReady("E2E Clip");

    const main = editor.lane("lane.main");
    const mainBox = await main.boundingBox();
    if (!mainBox) throw new Error("missing Main lane box");

    await main.evaluate(
      (element, { x, y, mime }) => {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData(mime, "shape.circle");
        element.dispatchEvent(
          new DragEvent("dragover", {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            dataTransfer,
          }),
        );
      },
      {
        x: mainBox.x + 160,
        y: mainBox.y - 8,
        mime: FRAME_LIBRARY_MIME,
      },
    );

    const indicator = page.getByTestId("timeline-insert-indicator");
    await expect(indicator).toHaveAttribute("data-drop-family", "visual");
    const indicatorBox = await indicator.boundingBox();
    if (!indicatorBox) throw new Error("missing visual insert indicator");
    expect(indicatorBox.y).toBeLessThanOrEqual(mainBox.y);
  });

  test("audio library item shows its insertion line below Main", async ({
    page,
  }) => {
    const projectId = "e2e.timeline.audio-indicator";
    const editor = await openSeededEditor(
      page,
      projectId,
      buildMainOnlyProject(projectId),
    );
    await editor.waitReady("E2E Clip");

    const main = editor.lane("lane.main");
    const mainBox = await main.boundingBox();
    if (!mainBox) throw new Error("missing Main lane box");

    await main.evaluate(
      (element, { x, y, mime }) => {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData(mime, "audio.test");
        element.dispatchEvent(
          new DragEvent("dragover", {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            dataTransfer,
          }),
        );
      },
      {
        x: mainBox.x + 160,
        y: mainBox.y + mainBox.height + 8,
        mime: AUDIO_LIBRARY_MIME,
      },
    );

    const indicator = page.getByTestId("timeline-insert-indicator");
    await expect(indicator).toHaveAttribute("data-drop-family", "audio");
    const indicatorBox = await indicator.boundingBox();
    if (!indicatorBox) throw new Error("missing audio insert indicator");
    expect(indicatorBox.y).toBeGreaterThanOrEqual(mainBox.y + mainBox.height - 1);
  });
});
