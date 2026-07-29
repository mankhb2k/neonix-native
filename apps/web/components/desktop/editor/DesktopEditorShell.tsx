"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  saveProject,
  type EditorProjectSnapshot,
} from "@/lib/editor/project-storage";
import { useEditorStore } from "@/lib/editor/editor-store";
import { Sidebar } from "./sidebar/Sidebar";
import { PreviewStage } from "./stage/PreviewStage";
import { RightDock } from "./inspector/RightDock";
import { Timeline } from "./timeline/Timeline";
import { PanelHeader } from "@/components/ui";
import { Header } from "./header/Header";
import { GlobalDragPreview } from "./GlobalDragPreview";

type Props = {
  initialSnapshot: EditorProjectSnapshot;
};

const AUTOSAVE_DEBOUNCE_MS = 400;

export function DesktopEditorShell({ initialSnapshot }: Props) {
  const loadProject = useEditorStore((s) => s.loadProject);
  const project = useEditorStore((s) => s.project);
  const timelineClips = useEditorStore((s) => s.timelineClips);
  const timelineLanes = useEditorStore((s) => s.timelineLanes);
  const projectId = useEditorStore((s) => s.project?.metadata.id);

  const [sidebarWidth, setSidebarWidth] = useState(580);
  const [rightDockWidth, setRightDockWidth] = useState(600);
  const [timelineHeight, setTimelineHeight] = useState(380);
  const [activeResizer, setActiveResizer] = useState<
    "sidebar" | "rightDock" | "timeline" | null
  >(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedProjectIdRef = useRef<string | null>(null);

  // Load once per project id từ snapshot đã đọc sẵn — không parse storage lại.
  useEffect(() => {
    const id = initialSnapshot.project.metadata.id;
    if (loadedProjectIdRef.current === id) return;
    loadedProjectIdRef.current = id;
    loadProject(
      initialSnapshot.project,
      initialSnapshot.overlayScenes,
      initialSnapshot.timelineClips,
      initialSnapshot.timelineLanes,
    );
  }, [initialSnapshot, loadProject]);

  // Single autosave owner (debounced) — page.tsx must not also save.
  useEffect(() => {
    if (!project) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveProject(project, { timelineClips, timelineLanes });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [project, timelineClips, timelineLanes]);

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

  const startRightDockResizing = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setActiveResizer("rightDock");
      const startX = e.clientX;
      const startWidth = rightDockWidth;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaX = startX - moveEvent.clientX;
        const newWidth = Math.min(850, Math.max(340, startWidth + deltaX));
        setRightDockWidth(newWidth);
      };

      const onPointerUp = () => {
        setActiveResizer(null);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [rightDockWidth],
  );

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
        activeResizer === "sidebar" || activeResizer === "rightDock"
          ? "cursor-ew-resize"
          : activeResizer === "timeline"
            ? "cursor-ns-resize"
            : ""
      }`}
    >
      <Header />

      <div
        className="flex-1 grid p-2 gap-2 overflow-hidden"
        style={{
          gridTemplateColumns: `${sidebarWidth / 16}rem 1fr ${rightDockWidth / 16}rem`,
          gridTemplateRows: `1fr ${timelineHeight / 16}rem`,
          gridTemplateAreas: `
            "sidebar stage rightDock"
            "timeline timeline timeline"
          `,
          transition: activeResizer ? "none" : "all 0.15s ease-out",
        }}
      >
        <div className="[grid-area:sidebar] relative bg-[var(--bg-panel)] rounded-xl flex flex-col shadow-md min-w-0 overflow-hidden">
          <div className="w-full h-full rounded-xl overflow-hidden flex flex-col min-w-0">
            <Sidebar />
          </div>
          <div
            onPointerDown={startSidebarResizing}
            className="absolute top-0 -right-2.5 bottom-0 w-3 cursor-ew-resize z-40 touch-none"
          />
        </div>

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

        <div className="[grid-area:rightDock] relative bg-[var(--bg-panel)] rounded-xl flex flex-col shadow-md min-w-0 overflow-hidden">
          <div className="w-full h-full rounded-xl overflow-hidden flex flex-col min-w-0">
            <RightDock />
          </div>
          <div
            onPointerDown={startRightDockResizing}
            className="absolute top-0 -left-2.5 bottom-0 w-3 cursor-ew-resize z-40 touch-none"
          />
        </div>

        <div className="[grid-area:timeline] relative bg-[var(--bg-panel)] rounded-xl flex flex-col shadow-md min-w-0 min-h-0 overflow-hidden">
          <div className="w-full h-full rounded-xl overflow-hidden flex flex-col min-w-0">
            <Timeline />
          </div>
          <div
            onPointerDown={startTimelineResizing}
            className="absolute -top-2.5 left-0 right-0 h-3 cursor-ns-resize z-40 touch-none"
          />
        </div>
      </div>

      {!projectId ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0a0c]/80 backdrop-blur-sm text-white text-sm">
          Đang tải editor…
        </div>
      ) : null}

      <GlobalDragPreview />
    </div>
  );
}
