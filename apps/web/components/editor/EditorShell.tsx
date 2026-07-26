"use client";

import { useEffect } from "react";
import { saveProject } from "@/lib/project-storage";
import { useEditorStore } from "@/lib/store/editor-store";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sidebar } from "./sidebar/Sidebar";
import { PreviewStage } from "./stage/PreviewStage";
import { RightDock } from "./inspector/RightDock";
import { Timeline } from "./timeline/Timeline";
import { Header } from "./header/Header";
import type { MotionProject } from "@motionvideo/motion-schema";

type Props = {
  initialProject: MotionProject;
};

export function EditorShell({ initialProject }: Props) {
  const loadProject = useEditorStore((s) => s.loadProject);
  const project = useEditorStore((s) => s.project);
  const sidebarOpen = useEditorStore((s) => s.sidebarOpen);
  const toggleSidebar = useEditorStore((s) => s.toggleSidebar);

  useEffect(() => {
    loadProject(initialProject);
  }, [initialProject, loadProject]);

  useEffect(() => {
    if (!project) return;
    saveProject(project);
  }, [project]);

  return (
    <div
      className={`grid h-screen w-screen overflow-hidden bg-[var(--bg-base)] text-[var(--fg)] relative transition-[grid-template-columns] duration-200 ease-out ${
        sidebarOpen
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
      <Header />
      
      <Sidebar />

      <button
        type="button"
        className={`absolute top-[80px] z-30 flex h-[26px] w-[26px] items-center justify-center rounded-md bg-[var(--bg-panel)] border border-[var(--line-strong)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--fg-muted)] hover:bg-[var(--bg-hover)] shadow-sm transition-all duration-200 ease-out cursor-pointer ${
          sidebarOpen ? "left-[328px]" : "left-[12px]"
        }`}
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? "Thu gọn sidebar" : "Mở rộng sidebar"}
        title={sidebarOpen ? "Thu gọn" : "Mở rộng"}
      >
        {sidebarOpen ? (
          <PanelLeftClose size={14} strokeWidth={1.5} />
        ) : (
          <PanelLeftOpen size={14} strokeWidth={1.5} />
        )}
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

      <Timeline />
      {!project ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--bg-base)]/80 backdrop-blur-sm">Đang tải editor…</div>
      ) : null}
    </div>
  );
}
