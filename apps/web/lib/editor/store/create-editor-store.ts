"use client";

import { create } from "zustand";
import { createClipActions } from "@/lib/editor/store/actions/clip-actions";
import { createClipboardActions } from "@/lib/editor/store/actions/clipboard-actions";
import { createDocumentActions } from "@/lib/editor/store/actions/document-actions";
import { createLaneActions } from "@/lib/editor/store/actions/lane-actions";
import { createProjectLifecycleActions } from "@/lib/editor/store/actions/project-lifecycle-actions";
import { createSelectionActions } from "@/lib/editor/store/actions/selection-actions";
import { createUiActions } from "@/lib/editor/store/actions/ui-actions";
import { createInitialEditorState } from "@/lib/editor/store/initial-state";
import type { EditorStore } from "@/lib/editor/store/types";

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...createInitialEditorState(),
  ...createUiActions(set),
  ...createSelectionActions(set, get),
  ...createLaneActions(set),
  ...createDocumentActions(set, get),
  ...createProjectLifecycleActions(set),
  ...createClipActions(set, get),
  ...createClipboardActions(set, get),
}));
