"use client";

import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { EditorStoreApi, EditorStoreState } from "@/lib/editor/state/editor-store";

export const EditorStoreContext = createContext<EditorStoreApi | null>(null);

export function useEditorStore<T>(selector: (state: EditorStoreState) => T): T {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error("useEditorStore must be used inside EditorProviders");
  return useStore(store, selector);
}

export const useEditorDocument = () => useEditorStore((state) => state.document);
export const useEditorSelection = () => useEditorStore((state) => state.selectedLayerIds);
export const useEditorVisibility = () => useEditorStore((state) => state.hiddenLayerIds);
export const useEditorLocks = () => useEditorStore((state) => state.lockedLayerIds);
export const useEditorTextEditSession = () => useEditorStore((state) => state.textEditSession);
export const useEditorTextEditStartPoint = () => useEditorStore((state) => state.textEditStartPoint);
export const useEditorTextEditCommitVersion = () => useEditorStore((state) => state.textEditCommitVersion);
