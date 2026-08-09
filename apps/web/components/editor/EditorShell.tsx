"use client";

import { EditorHeader } from "@/components/editor/header/EditorHeader";
import { SchemaInspector } from "@/components/editor/inspector/SchemaInspector";
import { LibraryDragPreview } from "@/components/editor/library/LibraryDragPreview";
import { Sidebar } from "@/components/editor/sidebar/Sidebar";
import { StageViewport } from "@/components/editor/stage/StageViewport";
import { useEditorAutosave } from "@/lib/editor/export/use-editor-autosave";
import { useEditorStore } from "@/lib/editor/editor-store";
import type { EditorProjectSnapshot } from "@/lib/editor/project-storage";
import { stageSizeForAspect } from "@/lib/runtime/preview-evaluate";
import { useEffect } from "react";

type Props = {
  initialSnapshot: EditorProjectSnapshot;
};

/**
 * AI Studio editor — 4 vùng: Header · Sidebar · Stage(+timeline) · Inspector(+AI).
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
  const { width, height } = stageSizeForAspect(active.metadata.aspectRatio);

  return (
    <div
      data-surface="editor"
      data-testid="editor-shell"
      className="grid h-screen w-screen overflow-hidden text-[var(--fg-primary)] [background:radial-gradient(ellipse_80%_50%_at_50%_-5%,rgba(13,148,136,0.06)_0%,transparent_55%),var(--bg-app)] [grid-template-areas:'header_header_header'_'sidebar_stage_inspector'] [grid-template-columns:var(--editor-left-w)_1fr_var(--editor-right-w)] [grid-template-rows:var(--editor-chrome-h)_1fr]"
    >
      <EditorHeader projectName={name} projectId={active.metadata.id} />
      <Sidebar />
      <StageViewport project={active} width={width} height={height} />
      <SchemaInspector />
      <LibraryDragPreview />
    </div>
  );
}
