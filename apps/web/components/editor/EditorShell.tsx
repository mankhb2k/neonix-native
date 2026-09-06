"use client";

import { PlaybackDebugPanel } from "@/components/editor/debug/PlaybackDebugPanel";
import { EditorProviders } from "@/components/editor/EditorProviders";
import { EditorHeader } from "@/components/editor/header/EditorHeader";
import { SchemaInspector } from "@/components/editor/inspector/SchemaInspector";
import { Sidebar } from "@/components/editor/sidebar/Sidebar";
import { StageViewport } from "@/components/editor/stage/StageViewport";
import { TimelineShell } from "@/components/editor/timeline/TimelineShell";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

const editorGridClass =
  "grid h-screen w-screen overflow-hidden bg-[var(--bg-site)] p-[var(--editor-shell-inset)] text-[var(--fg-primary)] gap-[var(--editor-panel-gap)] [grid-template-areas:'header_header_header'_'sidebar_stage_inspector'_'sidebar_timeline_inspector'] [grid-template-columns:var(--editor-left-w)_minmax(0,1fr)_var(--editor-right-w)] [grid-template-rows:var(--editor-chrome-h)_minmax(0,1fr)_minmax(120px,var(--editor-timeline-h))]";

/** The five-panel editor shell with a single Protocol V2 document boundary. */
export function EditorShell({
  initialDocument,
  projectRef,
  initialRevisionNo,
}: {
  initialDocument: MotionProtocolV2;
  projectRef?: string;
  initialRevisionNo?: number;
}) {
  return (
    <EditorProviders
      initialDocument={initialDocument}
      projectRef={projectRef}
      initialRevisionNo={initialRevisionNo}
    >
      <div
        data-surface="editor"
        data-testid="editor-shell"
        className={`${editorGridClass} editor-shell-grid`}
      >
        <EditorHeader />
        <Sidebar projectRef={projectRef} />
        <StageViewport />
        <TimelineShell />
        <SchemaInspector />
        <PlaybackDebugPanel />
      </div>
    </EditorProviders>
  );
}
