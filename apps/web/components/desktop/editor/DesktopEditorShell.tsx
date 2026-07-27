"use client";

import { useCallback, useEffect, useState } from "react";
import { saveProject } from "@/lib/project-storage";
import { useEditorStore } from "@/lib/store/editor-store";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sidebar } from "./sidebar/Sidebar";
import { PreviewStage } from "./stage/PreviewStage";
import { RightDock } from "./inspector/RightDock";
import { Timeline } from "./timeline/Timeline";
import { PanelHeader } from "@/components/ui";
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

  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [rightdockWidth, setRightdockWidth] = useState(340);
  const [timelineHeight, setTimelineHeight] = useState(260);
  const [activeResizer, setActiveResizer] = useState<"sidebar" | "rightdock" | "timeline" | null>(null);

  useEffect(() => {
    loadProject(initialProject);
  }, [initialProject, loadProject]);

  useEffect(() => {
    if (!project) return;
    saveProject(project);
  }, [project]);

  // Handler: Resizing Sidebar Width (Horizontal Drag)
  const startSidebarResizing = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setActiveResizer("sidebar");
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const newWidth = Math.min(650, Math.max(260, startWidth + deltaX));
        setSidebarWidth(newWidth);
      };

      const onPointerUp = () => {
        setActiveResizer(null);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [sidebarWidth],
  );

  // Handler: Resizing RightDock / Inspector Width (Horizontal Drag)
  const startRightdockResizing = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setActiveResizer("rightdock");
      const startX = e.clientX;
      const startWidth = rightdockWidth;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaX = startX - moveEvent.clientX;
        const newWidth = Math.min(550, Math.max(260, startWidth + deltaX));
        setRightdockWidth(newWidth);
      };

      const onPointerUp = () => {
        setActiveResizer(null);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [rightdockWidth],
  );

  // Handler: Resizing Timeline Height (Vertical Drag)
  const startTimelineResizing = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setActiveResizer("timeline");
      const startY = e.clientY;
      const startHeight = timelineHeight;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaY = startY - moveEvent.clientY;
        const newHeight = Math.min(550, Math.max(160, startHeight + deltaY));
        setTimelineHeight(newHeight);
      };

      const onPointerUp = () => {
        setActiveResizer(null);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [timelineHeight],
  );

  return (
    <div
      className={`flex h-screen w-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--fg)] relative select-none ${
        activeResizer === "sidebar" || activeResizer === "rightdock"
          ? "cursor-ew-resize"
          : activeResizer === "timeline"
          ? "cursor-ns-resize"
          : ""
      }`}
    >
      {/* Top Desktop Header Bar */}
      <Header />

      {/* Main 4-Panel Gap Grid (CapCut / Desktop NLE Style) */}
      <div
        className="flex-1 grid p-2 gap-2 overflow-hidden"
        style={{
          gridTemplateColumns: sidebarOpen
            ? `${sidebarWidth}px 1fr ${rightdockWidth}px`
            : `0px 1fr ${rightdockWidth}px`,
          gridTemplateRows: `1fr ${timelineHeight}px`,
          gridTemplateAreas: `
            "sidebar stage rightdock"
            "timeline timeline timeline"
          `,
          transition: activeResizer ? "none" : "all 0.15s ease-out",
        }}
      >
        {/* Panel 1: Top-Left Assets / Library Sidebar Card */}
        <div
          className={`[grid-area:sidebar] relative bg-[var(--bg-panel)] rounded-xl flex flex-col shadow-md transition-opacity duration-150 ${
            sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="w-full h-full rounded-xl overflow-hidden flex flex-col">
            <Sidebar />
          </div>

          {/* Gap Drag Handle: Sidebar & Stage */}
          {sidebarOpen ? (
            <div
              onPointerDown={startSidebarResizing}
              className="absolute top-0 -right-2.5 bottom-0 w-3 cursor-ew-resize z-40 touch-none"
              title="Kéo để thay đổi kích thước Sidebar"
            />
          ) : null}
        </div>

        {/* Panel 2: Top-Center Preview Stage Card */}
        <main
          className="[grid-area:stage] bg-[var(--bg-panel)] rounded-xl overflow-hidden relative flex flex-col shadow-md"
        >
          <PanelHeader
            title={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded bg-[#27272a] text-[#a0a0a5] hover:bg-[#3f3f46] hover:text-white shadow-sm transition-all cursor-pointer"
                  onClick={toggleSidebar}
                  aria-label={sidebarOpen ? "Thu gọn sidebar" : "Mở rộng sidebar"}
                  title={sidebarOpen ? "Thu gọn" : "Mở rộng"}
                >
                  {sidebarOpen ? (
                    <PanelLeftClose size={13} strokeWidth={1.5} />
                  ) : (
                    <PanelLeftOpen size={13} strokeWidth={1.5} />
                  )}
                </button>
                <span className="font-semibold text-[13px] text-[var(--fg)]">Trình phát</span>
              </div>
            }
          />

          <div
            className="relative flex-1 flex items-center justify-center overflow-hidden"
            style={{
              backgroundImage: "radial-gradient(#27272A 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          >
            <PreviewStage />
          </div>
        </main>

        {/* Panel 3: Top-Right Inspector Card */}
        <div className="[grid-area:rightdock] relative bg-[var(--bg-panel)] rounded-xl flex flex-col shadow-md">
          <div className="w-full h-full rounded-xl overflow-hidden flex flex-col">
            <RightDock />
          </div>

          {/* Gap Drag Handle: Stage & Inspector */}
          <div
            onPointerDown={startRightdockResizing}
            className="absolute top-0 -left-2.5 bottom-0 w-3 cursor-ew-resize z-40 touch-none"
            title="Kéo để thay đổi kích thước Inspector"
          />
        </div>

        {/* Panel 4: Bottom Full-Width Timeline Card */}
        <div className="[grid-area:timeline] relative bg-[var(--bg-panel)] rounded-xl flex flex-col shadow-md">
          <div className="w-full h-full rounded-xl overflow-hidden flex flex-col">
            <Timeline />
          </div>

          {/* Gap Drag Handle: Top Panels & Timeline */}
          <div
            onPointerDown={startTimelineResizing}
            className="absolute -top-2.5 left-0 right-0 h-3 cursor-ns-resize z-40 touch-none"
            title="Kéo để thay đổi chiều cao Timeline"
          />
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
