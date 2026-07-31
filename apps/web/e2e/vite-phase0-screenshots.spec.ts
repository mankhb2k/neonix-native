/**
 * Capture Phase 0 UI baselines into docs/migration/vite-phase-0/screenshots/.
 *
 *   pnpm --filter @motionvideo/web e2e -- e2e/vite-phase0-screenshots.spec.ts
 */

import fs from "node:fs";
import path from "node:path";
import { openSeededEditor, test } from "./fixtures/editor.fixture";
import type { StoredEditorProject } from "./fixtures/project-builders";

const SCREENSHOT_DIR = path.resolve(
  __dirname,
  "../../../docs/migration/vite-phase-0/screenshots",
);

function loadFixture(name: "small" | "medium"): StoredEditorProject {
  const filePath = path.resolve(
    __dirname,
    `../../../docs/migration/vite-phase-0/fixtures/${name}.project.json`,
  );
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as StoredEditorProject;
}

test.describe("Vite Phase 0 screenshot baselines", () => {
  test("workspace / timeline / stage", async ({ page }) => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    const small = loadFixture("small");
    const projectId =
      (small.project as { metadata?: { id?: string } }).metadata?.id ??
      "vite-phase0.small";

    await openSeededEditor(page, projectId, small);
    await page.getByTestId("runtime-preview-canvas").waitFor({
      state: "visible",
      timeout: 30_000,
    });

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "workspace.png"),
      fullPage: false,
    });

    const timeline = page.getByTestId("timeline-tracks-scroll");
    await timeline.screenshot({
      path: path.join(SCREENSHOT_DIR, "timeline.png"),
    });

    const stage = page.getByTestId("runtime-preview-stage");
    await stage.screenshot({
      path: path.join(SCREENSHOT_DIR, "stage.png"),
    });
  });
});
