"use client";

import { AskAIBar } from "@/components/editor/ai/AskAIBar";
import { SchemaInspector } from "@/components/editor/inspector/SchemaInspector";
import { LeftRail } from "@/components/editor/left-rail/LeftRail";
import { StageViewport } from "@/components/editor/stage/StageViewport";
import { MinimalTimeline } from "@/components/editor/timeline/MinimalTimeline";
import { EditorTopBar } from "@/components/editor/topbar/EditorTopBar";
import type { EditorProjectSnapshot } from "@/lib/editor/project-storage";
import { stageSizeForAspect } from "@/lib/runtime/preview-evaluate";

type Props = {
  initialSnapshot: EditorProjectSnapshot;
};

/**
 * AI Studio editor shell (web-architecture §13).
 * CapCut desktop tree removed — panels are scaffolds until W0–W4 capability PRs.
 */
export function EditorShell({ initialSnapshot }: Props) {
  const { project } = initialSnapshot;
  const name = project.metadata.name || "Untitled";
  const { width, height } = stageSizeForAspect(project.metadata.aspectRatio);

  return (
    <div
      data-surface="editor"
      data-testid="editor-shell"
      className="editor-shell"
    >
      <EditorTopBar projectName={name} projectId={project.metadata.id} />
      <LeftRail />
      <StageViewport projectName={name} width={width} height={height} />
      <SchemaInspector />
      <MinimalTimeline />
      <AskAIBar />
    </div>
  );
}
