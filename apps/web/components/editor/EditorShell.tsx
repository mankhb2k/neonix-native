"use client";

import { EditorSurfaceProvider } from "@/components/editor/EditorSurfaceProvider";
import { EditorHeader } from "@/components/editor/header/EditorHeader";
import { SchemaInspector } from "@/components/editor/inspector/SchemaInspector";
import { Sidebar } from "@/components/editor/sidebar/Sidebar";
import { V2StageViewport } from "@/components/editor/stage/V2StageViewport";
import { TimelineShell } from "@/components/editor/timeline/TimelineShell";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

const editorGridClass =
  "grid h-screen w-screen overflow-hidden bg-[var(--bg-site)] p-[var(--editor-shell-inset)] text-[var(--fg-primary)] gap-[var(--editor-panel-gap)] [grid-template-areas:'header_header_header'_'sidebar_stage_inspector'_'sidebar_timeline_inspector'] [grid-template-columns:var(--editor-left-w)_minmax(0,1fr)_var(--editor-right-w)] [grid-template-rows:var(--editor-chrome-h)_minmax(0,1fr)_minmax(120px,var(--editor-timeline-h))]";

/** The original five-panel EditorShell with a Protocol V2 document boundary. */
export function EditorShell({ v2Document }: { v2Document: MotionProtocolV2 }) {
  return (
    <EditorSurfaceProvider initialDocument={v2Document}>
      <div
        data-surface="editor"
        data-testid="editor-shell"
        className={`${editorGridClass} editor-shell-grid`}
      >
        <EditorHeader />
        <Sidebar />
        <V2StageViewport />
        <TimelineShell />
        <SchemaInspector />
      </div>
    </EditorSurfaceProvider>
  );
}
