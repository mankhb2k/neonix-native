"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { trySaveProject } from "@/lib/editor/project-storage";

const AUTOSAVE_MS = 800;

/** Optimistic local autosave pinned to dirtyRevision / envelope revision. */
export function useEditorAutosave() {
  const project = useEditorStore((s) => s.project);
  const clips = useEditorStore((s) => s.timelineClips);
  const lanes = useEditorStore((s) => s.timelineLanes);
  const dirtyRevision = useEditorStore((s) => s.dirtyRevision);
  const savedRevision = useEditorStore((s) => s.savedRevision);
  const markDocumentSaved = useEditorStore((s) => s.markDocumentSaved);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!project || dirtyRevision === savedRevision) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const result = trySaveProject(project, {
        timelineClips: clips,
        timelineLanes: lanes,
      });
      if (result.ok) {
        markDocumentSaved();
      }
    }, AUTOSAVE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [
    project,
    clips,
    lanes,
    dirtyRevision,
    savedRevision,
    markDocumentSaved,
  ]);
}
