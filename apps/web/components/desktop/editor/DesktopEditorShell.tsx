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

export function DesktopEditorShell({ initialProject }: Props) {
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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0a0a0c] text-[var(--fg)] relative select-none">
      {/* Top Desktop Header Bar */}
      <Header />

      {/* Main 4-Panel Gap Grid (CapCut / Desktop NLE Style) */}
      <div
        className={`flex-1 grid p-2 gap-2 overflow-hidden transition-[grid-template-columns] duration-200 ease-out ${
          sidebarOpen
            ? "grid-rows-[1fr_260px] grid-cols-[340px_1fr_340px]"
            : "grid-rows-[1fr_260px] grid-cols-[0px_1fr_340px]"
        }`}
        style={{
          gridTemplateAreas: `
            "sidebar stage rightdock"
            "timeline timeline timeline"
          `,
        }}
      >
        {/* Panel 1: Top-Left Assets / Library Sidebar Card */}
        <div
          className={`[grid-area:sidebar] bg-[#18181c] border border-[#27272b] rounded-xl overflow-hidden flex flex-col shadow-md transition-opacity duration-150 ${
            sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <Sidebar />
        </div>

        {/* Panel 2: Top-Center Preview Stage Card */}
        <main
          className="[grid-area:stage] bg-[#141417] border border-[#27272b] rounded-xl overflow-hidden relative flex items-center justify-center shadow-md"
          style={{
            backgroundImage: "radial-gradient(#27272A 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        >
          {/* Toggle Sidebar Floating Button */}
          <button
            type="button"
            className="absolute top-3 left-3 z-30 flex h-[28px] w-[28px] items-center justify-center rounded-lg bg-[#222226]/90 border border-[#35353a] text-[#a0a0a5] hover:text-white hover:border-[#55555a] hover:bg-[#2a2a2f] shadow-sm transition-all cursor-pointer"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? "Thu gọn sidebar" : "Mở rộng sidebar"}
            title={sidebarOpen ? "Thu gọn" : "Mở rộng"}
          >
            {sidebarOpen ? (
              <PanelLeftClose size={15} strokeWidth={1.5} />
            ) : (
              <PanelLeftOpen size={15} strokeWidth={1.5} />
            )}
          </button>

          <PreviewStage />
        </main>

        {/* Panel 3: Top-Right Inspector Card */}
        <div className="[grid-area:rightdock] bg-[#18181c] border border-[#27272b] rounded-xl overflow-hidden flex flex-col shadow-md">
          <RightDock />
        </div>

        {/* Panel 4: Bottom Full-Width Timeline Card */}
        <div className="[grid-area:timeline] bg-[#18181c] border border-[#27272b] rounded-xl overflow-hidden flex flex-col shadow-md">
          <Timeline />
        </div>
      </div>

      {!project ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0a0c]/80 backdrop-blur-sm text-white text-sm">
          Đang tải editor…
        </div>
      ) : null}
    </div>
  );
}
