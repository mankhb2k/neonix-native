"use client";

import { useEffect, useState } from "react";
import { saveProject } from "@/lib/project-storage";
import { useEditorStore } from "@/lib/store/editor-store";
import { Sidebar } from "./sidebar/Sidebar";
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
    <div
      className={`grid h-screen w-screen overflow-hidden bg-[var(--bg-base)] text-[var(--fg)] relative ${
        toolsOpen
          ? "grid-rows-[74px_1fr_240px] grid-cols-[320px_1fr_320px]"
          : "grid-rows-[74px_1fr_240px] grid-cols-[0px_1fr_320px]"
      }`}
      style={{
        gridTemplateAreas: `
          "header header header"
          "sidebar stage rightdock"
          "timeline timeline timeline"
        `
      }}
    >
      <TopBar />
      
      <Sidebar />
      
      <button
        type="button"
        className={`absolute top-1/2 -translate-y-1/2 z-30 flex h-[36px] w-[16px] items-center justify-center rounded-r bg-[var(--bg-panel)] border border-[var(--line-strong)] text-[var(--fg-muted)] cursor-pointer hover:text-[var(--fg)] hover:bg-[var(--bg-hover)] transition-all duration-300 ${toolsOpen ? "left-[320px]" : "left-0"}`}
        onClick={() => setToolsOpen((open) => !open)}
        aria-label={toolsOpen ? "Thu gọn panel phụ" : "Mở panel phụ"}
        aria-expanded={toolsOpen}
        title={toolsOpen ? "Thu gọn" : "Mở rộng"}
      >
        <span aria-hidden>
          {toolsOpen ? "‹" : "›"}
        </span>
      </button>

      <main 
        className="relative flex items-center justify-center overflow-hidden bg-[var(--bg-base)] [grid-area:stage]" 
        style={{ 
          backgroundImage: 'radial-gradient(#27272A 1px, transparent 1px)', 
          backgroundSize: '20px 20px' 
        }}
      >
        <PreviewStage />
      </main>

      <RightDock />
      
      <div className="col-span-full flex flex-col overflow-hidden border-t border-[var(--line)] bg-[var(--bg-panel)] [grid-area:timeline]">
        <Timeline />
      </div>
      {!project ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--bg-base)]/80 backdrop-blur-sm">Đang tải editor…</div>
      ) : null}
    </div>
  );
}
