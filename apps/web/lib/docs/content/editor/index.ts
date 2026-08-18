import type { DocsPageView } from "@/lib/docs/content/page-view";
import { editorGroupViewPage } from "./group-view";
import { editorMainPage } from "./main";
import { editorOverviewPage } from "./overview";

export type EditorSlug = "editor" | "editor/main" | "editor/group";

const EDITOR_SLUGS = new Set<string>(["editor", "editor/main", "editor/group"]);

export function isEditorSlug(slug: string): slug is EditorSlug {
  return EDITOR_SLUGS.has(slug);
}

export function getEditorPage(slug: EditorSlug): DocsPageView {
  switch (slug) {
    case "editor":
      return editorOverviewPage();
    case "editor/main":
      return editorMainPage();
    case "editor/group":
      return editorGroupViewPage();
  }
}
