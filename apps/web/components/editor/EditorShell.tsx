"use client";

import { AskAIBar } from "@/components/editor/ai/AskAIBar";
import { SchemaInspector } from "@/components/editor/inspector/SchemaInspector";
import { LeftRail } from "@/components/editor/left-rail/LeftRail";
import { StageViewport } from "@/components/editor/stage/StageViewport";
import { MinimalTimeline } from "@/components/editor/timeline/MinimalTimeline";
import { EditorTopBar } from "@/components/editor/topbar/EditorTopBar";
import { useEditorStore } from "@/lib/editor/editor-store";
import type { EditorProjectSnapshot } from "@/lib/editor/project-storage";
import { stageSizeForAspect } from "@/lib/runtime/preview-evaluate";
import { useEffect } from "react";

type Props = {
  initialSnapshot: EditorProjectSnapshot;
};

/**
 * AI Studio editor shell (web-architecture §13).
 */
export function EditorShell({ initialSnapshot }: Props) {
  const loadProject = useEditorStore((s) => s.loadProject);
  const project = useEditorStore((s) => s.project);

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
      className="editor-shell"
    >
      <EditorTopBar projectName={name} projectId={active.metadata.id} />
      <LeftRail />
      <StageViewport project={active} width={width} height={height} />
      <SchemaInspector />
      <MinimalTimeline />
      <AskAIBar />
    </div>
  );
}
