"use client";

import { useCallback, useEffect, useState } from "react";
import { saveProject } from "@/lib/project-storage";
import { useEditorStore } from "@/lib/store/editor-store";
import { Sidebar } from "./sidebar/Sidebar";
import { PreviewStage } from "./stage/PreviewStage";
import { RightDock } from "./inspector/RightDock";
import { Timeline } from "./timeline/Timeline";
import { PanelHeader } from "@/components/ui";
import { Header } from "./header/Header";
import { GlobalDragPreview } from "./GlobalDragPreview";

import type { MotionProject } from "@motionvideo/motion-schema";

type Props = {
  initialProject: MotionProject;
};

export function DesktopEditorShell({ initialProject }: Props) {
  const loadProject = useEditorStore((s) => s.loadProject);
  const project = useEditorStore((s) => s.project);

  // Default widths in px (1rem = 16px)
  const [sidebarWidth, setSidebarWidth] = useState(560); // 35rem
  const [rightdockWidth, setRightdockWidth] = useState(600); // 37.5rem
  const [timelineHeight, setTimelineHeight] = useState(380); // 23.75rem
  const [activeResizer, setActiveResizer] = useState<
    "sidebar" | "rightdock" | "timeline" | null
  >(null);

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
        const newWidth = Math.min(800, Math.max(320, startWidth + deltaX));
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
        const newWidth = Math.min(850, Math.max(340, startWidth + deltaX));
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
        const newHeight = Math.min(650, Math.max(200, startHeight + deltaY));
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
          gridTemplateColumns: `${sidebarWidth / 16}rem 1fr ${rightdockWidth / 16}rem`,
          gridTemplateRows: `1fr ${timelineHeight / 16}rem`,
          gridTemplateAreas: `
            "sidebar stage rightdock"
            "timeline timeline timeline"
          `,
          transition: activeResizer ? "none" : "all 0.15s ease-out",
        }}
      >
        {/* Panel 1: Top-Left Assets / Library Sidebar Card */}
        <div className="[grid-area:sidebar] relative bg-[var(--bg-panel)] rounded-xl flex flex-col shadow-md min-w-0 overflow-hidden">
          <div className="w-full h-full rounded-xl overflow-hidden flex flex-col min-w-0">
            <Sidebar />
          </div>

          {/* Gap Drag Handle: Sidebar & Stage */}
          <div
            onPointerDown={startSidebarResizing}
            className="absolute top-0 -right-2.5 bottom-0 w-3 cursor-ew-resize z-40 touch-none"
          />
        </div>

        {/* Panel 2: Top-Center Preview Stage Card */}
        <main className="[grid-area:stage] bg-[var(--bg-panel)] rounded-xl overflow-hidden relative flex flex-col shadow-md min-w-0">
          <PanelHeader title="Trình phát" />

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
        <div className="[grid-area:rightdock] relative bg-[var(--bg-panel)] rounded-xl flex flex-col shadow-md min-w-0 overflow-hidden">
          <div className="w-full h-full rounded-xl overflow-hidden flex flex-col min-w-0">
            <RightDock />
          </div>

          {/* Gap Drag Handle: Stage & Inspector */}
          <div
            onPointerDown={startRightdockResizing}
            className="absolute top-0 -left-2.5 bottom-0 w-3 cursor-ew-resize z-40 touch-none"
          />
        </div>

        {/* Panel 4: Bottom Full-Width Timeline Card */}
        <div className="[grid-area:timeline] relative bg-[var(--bg-panel)] rounded-xl flex flex-col shadow-md min-w-0 min-h-0 overflow-hidden">
          <div className="w-full h-full rounded-xl overflow-hidden flex flex-col min-w-0">
            <Timeline />
          </div>

          {/* Gap Drag Handle: Top Panels & Timeline */}
          <div
            onPointerDown={startTimelineResizing}
            className="absolute -top-2.5 left-0 right-0 h-3 cursor-ns-resize z-40 touch-none"
          />
        </div>
      </div>

      {!project ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0a0c]/80 backdrop-blur-sm text-white text-sm">
          Đang tải editor…
        </div>
      ) : null}

      <GlobalDragPreview />
    </div>
  );
}
