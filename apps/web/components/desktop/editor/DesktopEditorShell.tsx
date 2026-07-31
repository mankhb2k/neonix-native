"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  trySaveProject,
  type EditorProjectSnapshot,
} from "@/lib/editor/project-storage";
import { useEditorStore } from "@/lib/editor/editor-store";
import { usePanelResize } from "@/hooks/editor/use-panel-resize";
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
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedProjectIdRef = useRef<string | null>(null);

  const setSidebarActive = useCallback(
    (active: boolean) => setActiveResizer(active ? "sidebar" : null),
    [],
  );
  const setRightDockActive = useCallback(
    (active: boolean) => setActiveResizer(active ? "rightDock" : null),
    [],
  );
  const setTimelineActive = useCallback(
    (active: boolean) => setActiveResizer(active ? "timeline" : null),
    [],
  );

  const { onPointerDown: startSidebarResizing } = usePanelResize({
    axis: "x",
    value: sidebarWidth,
    min: 320,
    max: 800,
    onChange: setSidebarWidth,
    onActiveChange: setSidebarActive,
  });
  const { onPointerDown: startRightDockResizing } = usePanelResize({
    axis: "x-inverted",
    value: rightDockWidth,
    min: 340,
    max: 850,
    onChange: setRightDockWidth,
    onActiveChange: setRightDockActive,
  });
  const { onPointerDown: startTimelineResizing } = usePanelResize({
    axis: "y-inverted",
    value: timelineHeight,
    min: 200,
    max: 650,
    onChange: setTimelineHeight,
    onActiveChange: setTimelineActive,
  });

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
    if (!project) return undefined;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const result = trySaveProject(project, { timelineClips, timelineLanes });
      if (!result.ok) {
        setSaveWarning(result.error.message);
        return;
      }
      setSaveWarning(null);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [project, timelineClips, timelineLanes]);

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

      {saveWarning ? (
        <div
          role="status"
          className="absolute top-14 left-1/2 z-50 -translate-x-1/2 rounded-md bg-[#7f1d1d] px-3 py-1.5 text-[12px] text-white shadow-lg"
        >
          {saveWarning}
        </div>
      ) : null}

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
