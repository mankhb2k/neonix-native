"use client";

import { useEffect, useState } from "react";
import { saveProject } from "@/lib/project-storage";
import { useEditorStore } from "@/lib/store/editor-store";
import { LeftSidebar } from "./LeftSidebar";
import { PreviewStage } from "./PreviewStage";
import { RightDock } from "./RightDock";
import { Timeline } from "./Timeline";
import { TopBar } from "./TopBar";
import type { MotionProject } from "@motionvideo/motion-schema";

type Props = {
  initialProject: MotionProject;
};

export function EditorShell({ initialProject }: Props) {
  const loadProject = useEditorStore((s) => s.loadProject);
  const project = useEditorStore((s) => s.project);
  const [toolsOpen, setToolsOpen] = useState(true);

  useEffect(() => {
    loadProject(initialProject);
  }, [initialProject, loadProject]);

  useEffect(() => {
    if (!project) return;
    saveProject(project);
  }, [project]);

  return (
    <div className={`mv-editor${toolsOpen ? "" : " is-tools-collapsed"}`}>
      <TopBar />
      
      <LeftSidebar />
      
      <button
        type="button"
        className="mv-tools-edge-toggle"
        onClick={() => setToolsOpen((open) => !open)}
        aria-label={toolsOpen ? "Thu gọn panel phụ" : "Mở panel phụ"}
        aria-expanded={toolsOpen}
        title={toolsOpen ? "Thu gọn" : "Mở rộng"}
      >
        <span className="mv-tools-edge-toggle-chevron" aria-hidden>
          {toolsOpen ? "‹" : "›"}
        </span>
      </button>

      <main className="canvas-area" style={{ gridArea: 'stage', backgroundColor: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundImage: 'radial-gradient(#27272A 1px, transparent 1px)', backgroundSize: '20px 20px', overflow: 'hidden' }}>
        <PreviewStage />
      </main>

      <RightDock />
      
      <div className="mv-timeline-area">
        <Timeline />
      </div>
      {!project ? (
        <div className="mv-editor-loading">Đang tải editor…</div>
      ) : null}
    </div>
  );
}
