"use client";

import { EditorHeader } from "@/components/editor/header/EditorHeader";
import { SchemaInspector } from "@/components/editor/inspector/SchemaInspector";
import { LibraryDragPreview } from "@/components/editor/library/LibraryDragPreview";
import { Sidebar } from "@/components/editor/sidebar/Sidebar";
import { StageViewport } from "@/components/editor/stage/StageViewport";
import { TimelineShell } from "@/components/editor/timeline/TimelineShell";
import { useEditorAutosave } from "@/lib/editor/export/use-editor-autosave";
import { useEditorStore } from "@/lib/editor/editor-store";
import type { EditorProjectSnapshot } from "@/lib/editor/project-storage";
import { stageSizeForAspect } from "@/lib/runtime/preview-evaluate";
import { compositionAspectRatio } from "@/lib/runtime/project-composition";
import { useEffect } from "react";

type Props = {
  initialSnapshot: EditorProjectSnapshot;
};

/**
 * AI Studio editor — 5 panel nổi (header · sidebar · stage · timeline · inspector).
 */
export function EditorShell({ initialSnapshot }: Props) {
  const loadProject = useEditorStore((s) => s.loadProject);
  const project = useEditorStore((s) => s.project);
  useEditorAutosave();

  useEffect(() => {
    loadProject(
      initialSnapshot.project,
      initialSnapshot.overlayScenes,
      initialSnapshot.timelineClips,
      initialSnapshot.timelineLanes,
    );
  }, [initialSnapshot, loadProject]);

  const active = project ?? initialSnapshot.project;
  const name = active.metadata.name || "Untitled";
  const { width, height } = stageSizeForAspect(compositionAspectRatio(active));

  return (
    <div
      data-surface="editor"
      data-testid="editor-shell"
      className="grid h-screen w-screen overflow-hidden bg-[var(--bg-site)] p-[var(--editor-shell-inset)] text-[var(--fg-primary)] gap-[var(--editor-panel-gap)] [grid-template-areas:'header_header_header'_'sidebar_stage_inspector'_'sidebar_timeline_inspector'] [grid-template-columns:var(--editor-left-w)_minmax(0,1fr)_var(--editor-right-w)] [grid-template-rows:var(--editor-chrome-h)_minmax(0,1fr)_minmax(120px,var(--editor-timeline-h))]"
    >
      <EditorHeader projectName={name} projectId={active.metadata.id} />
      <Sidebar />
      <StageViewport project={active} width={width} height={height} />
      <TimelineShell />
      <SchemaInspector />
      <LibraryDragPreview />
    </div>
  );
}
