import { test as base, expect, type Page } from "@playwright/test";
import {
  STORAGE_KEY,
  type StoredEditorProject,
} from "./project-builders";
import { EditorPage } from "../pages/editor.page";

type EditorFixtures = {
  editor: EditorPage;
};

/** Viewport sized for timeline DnD; EditorPage helper on every test. */
export const test = base.extend<EditorFixtures>({
  editor: async ({ page }, use) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await use(new EditorPage(page));
  },
});

export { expect };

/** Seed localStorage then open the editor for a stored project. */
export async function openSeededEditor(
  page: Page,
  projectId: string,
  stored: StoredEditorProject,
): Promise<EditorPage> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(
    ({ key, id, record }) => {
      window.localStorage.setItem(key, JSON.stringify({ [id]: record }));
    },
    { key: STORAGE_KEY, id: projectId, record: stored },
  );
  const editor = new EditorPage(page);
  await editor.goto(projectId);
  return editor;
}
