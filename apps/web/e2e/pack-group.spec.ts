import { expect, openSeededEditor, test } from "./fixtures/editor.fixture";
import { buildPackedMainWithGroupProject } from "./fixtures/project-builders";

test.describe("packed Main + group drill-in", () => {
  test("packs sequential roots on Main and double-click group enters layer view", async ({
    page,
  }) => {
    const projectId = "e2e.editor.pack-group";
    const editor = await openSeededEditor(
      page,
      projectId,
      buildPackedMainWithGroupProject(projectId),
    );
    await editor.waitReady("Hero");

    await expect(page.getByTestId("editor-timeline")).toHaveAttribute(
      "data-timeline-scope",
      "main",
    );
    await expect(editor.clip("video-a")).toBeVisible({ timeout: 30_000 });
    await expect(editor.clip("video-b")).toBeVisible();
    await expect(editor.clip("hero")).toBeVisible();
    await editor.expectClipInLane("video-a", "lane.main");
    await editor.expectClipInLane("hero", "lane.main");

    await editor.clip("hero").dblclick();
    await expect(page.getByTestId("editor-timeline")).toHaveAttribute(
      "data-timeline-scope",
      "group",
    );
    await expect(page.getByTestId("timeline-group-back")).toBeVisible();
    await expect(page.getByText("Title").first()).toBeVisible();
    await expect(editor.clip("hero.title")).toBeVisible();
    await expect(editor.clip("hero")).toHaveCount(0);

    await page.getByTestId("timeline-group-back").click();
    await expect(page.getByTestId("editor-timeline")).toHaveAttribute(
      "data-timeline-scope",
      "main",
    );
    await expect(editor.clip("hero")).toBeVisible();
  });

  test("sidebar JSON tab shows protocol document without laneId", async ({
    page,
  }) => {
    const projectId = "e2e.editor.pack-json";
    await openSeededEditor(
      page,
      projectId,
      buildPackedMainWithGroupProject(projectId),
    );
    await page.getByRole("tab", { name: "JSON" }).click();
    const panel = page.getByTestId("protocol-json-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("protocol-json-parse-badge")).toHaveAttribute(
      "data-parse-ok",
      "true",
    );
    const pre = page.getByTestId("protocol-json-pre");
    await expect(pre).toContainText("formatVersion");
    await expect(pre).toContainText("video-a");
    await expect(pre).toContainText("hero");
    await expect(pre).not.toContainText("laneId");
    await expect(page.getByTestId("protocol-json-copy")).toBeVisible();
  });
});
