"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { PlaybackDebugPanel } from "@/components/editor/debug/PlaybackDebugPanel";
import { EditorProviders } from "@/components/editor/EditorProviders";
import { EditorHeader } from "@/components/editor/header/EditorHeader";
import { InspectorShell } from "@/components/editor/inspector/InspectorShell";
import { Sidebar } from "@/components/editor/sidebar/Sidebar";
import { StageViewport } from "@/components/editor/stage/StageViewport";
import { TimelineShell } from "@/components/editor/timeline/TimelineShell";
import { EditorKeyboardBridge } from "@/hooks/editor/use-editor-keyboard-bridge";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

const editorGridClass =
  "relative grid h-screen w-screen overflow-hidden bg-[var(--bg-site)] p-[var(--editor-shell-inset)] text-[var(--fg-primary)] gap-[var(--editor-panel-gap)] [grid-template-areas:'header_header_header'_'sidebar_stage_inspector'_'sidebar_timeline_inspector'] [grid-template-columns:var(--editor-left-w)_minmax(0,1fr)_var(--editor-right-w)] [grid-template-rows:var(--editor-chrome-h)_minmax(0,1fr)_minmax(120px,var(--editor-timeline-h))]";

const EDITOR_LAYOUT_STORAGE_KEY = "neonix:editor-layout:v1";
const DEFAULT_EDITOR_LAYOUT = {
  sidebarWidth: 380,
  inspectorWidth: 420,
  timelineHeight: 240,
} as const;
const EDITOR_LAYOUT_LIMITS = {
  sidebarWidth: { min: 220, max: 520 },
  inspectorWidth: { min: 280, max: 560 },
  timelineHeight: { min: 140, max: 520 },
} as const;

type EditorLayout = {
  sidebarWidth: number;
  inspectorWidth: number;
  timelineHeight: number;
};

type ResizeMode = keyof EditorLayout;

type ActiveResize = {
  mode: ResizeMode;
  startX: number;
  startY: number;
  startValue: number;
};

function clampEditorLayoutValue(mode: ResizeMode, value: number): number {
  const limits = EDITOR_LAYOUT_LIMITS[mode];
  return Math.round(Math.min(limits.max, Math.max(limits.min, value)));
}

function readEditorLayout(): EditorLayout {
  if (typeof window === "undefined") return { ...DEFAULT_EDITOR_LAYOUT };
  try {
    const stored = JSON.parse(window.localStorage.getItem(EDITOR_LAYOUT_STORAGE_KEY) ?? "null") as Partial<EditorLayout> | null;
    return {
      sidebarWidth: clampEditorLayoutValue("sidebarWidth", Number(stored?.sidebarWidth ?? DEFAULT_EDITOR_LAYOUT.sidebarWidth)),
      inspectorWidth: clampEditorLayoutValue("inspectorWidth", Number(stored?.inspectorWidth ?? DEFAULT_EDITOR_LAYOUT.inspectorWidth)),
      timelineHeight: clampEditorLayoutValue("timelineHeight", Number(stored?.timelineHeight ?? DEFAULT_EDITOR_LAYOUT.timelineHeight)),
    };
  } catch {
    return { ...DEFAULT_EDITOR_LAYOUT };
  }
}

function EditorLayoutResizers({
  layout,
  onChange,
  onReset,
}: {
  layout: EditorLayout;
  onChange: (mode: ResizeMode, startValue: number, deltaX: number, deltaY: number) => void;
  onReset: (mode: ResizeMode) => void;
}) {
  const activeResizeRef = useRef<ActiveResize | null>(null);
  const [activeMode, setActiveMode] = useState<ResizeMode | null>(null);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const active = activeResizeRef.current;
      if (!active) return;
      onChange(
        active.mode,
        active.startValue,
        event.clientX - active.startX,
        event.clientY - active.startY,
      );
    };
    const onPointerUp = () => {
      activeResizeRef.current = null;
      setActiveMode(null);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [onChange]);

  const startResize = useCallback((event: ReactPointerEvent<HTMLDivElement>, mode: ResizeMode) => {
    if (event.button !== 0) return;
    event.preventDefault();
    activeResizeRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startValue: layout[mode],
    };
    setActiveMode(mode);
  }, [layout]);

  const handleClass = (mode: ResizeMode) =>
    `pointer-events-auto absolute z-50 rounded-sm bg-transparent transition-colors hover:bg-[var(--accent)]/45 ${activeMode === mode ? "bg-[var(--accent)]/70" : ""}`;

  const commonProps = (mode: ResizeMode) => ({
    role: "separator" as const,
    tabIndex: 0,
    "aria-valuenow": layout[mode],
    "aria-valuemin": EDITOR_LAYOUT_LIMITS[mode].min,
    "aria-valuemax": EDITOR_LAYOUT_LIMITS[mode].max,
    onDoubleClick: () => onReset(mode),
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => startResize(event, mode),
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-40" data-testid="editor-layout-resizers">
      <div
        {...commonProps("sidebarWidth")}
        className={`${handleClass("sidebarWidth")} top-[calc(var(--editor-shell-inset)+var(--editor-chrome-h)+var(--editor-panel-gap))] bottom-[var(--editor-shell-inset)] w-1.5 cursor-col-resize`}
        style={{ left: "calc(var(--editor-shell-inset) + var(--editor-left-w) + var(--editor-panel-gap) / 2 - 3px)" }}
        aria-label="Resize sidebar"
        data-testid="editor-resize-sidebar"
      />
      <div
        {...commonProps("inspectorWidth")}
        className={`${handleClass("inspectorWidth")} top-[calc(var(--editor-shell-inset)+var(--editor-chrome-h)+var(--editor-panel-gap))] bottom-[var(--editor-shell-inset)] w-1.5 cursor-col-resize`}
        style={{ right: "calc(var(--editor-shell-inset) + var(--editor-right-w) + var(--editor-panel-gap) / 2 - 3px)" }}
        aria-label="Resize inspector"
        data-testid="editor-resize-inspector"
      />
      <div
        {...commonProps("timelineHeight")}
        className={`${handleClass("timelineHeight")} left-[calc(var(--editor-shell-inset)+var(--editor-left-w)+var(--editor-panel-gap))] right-[calc(var(--editor-shell-inset)+var(--editor-right-w)+var(--editor-panel-gap))] h-1.5 cursor-row-resize`}
        style={{ top: "calc(100% - var(--editor-shell-inset) - var(--editor-timeline-h) - var(--editor-panel-gap) / 2 - 3px)" }}
        aria-label="Resize timeline"
        data-testid="editor-resize-timeline"
      />
    </div>
  );
}

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
  const [layout, setLayout] = useState<EditorLayout>(DEFAULT_EDITOR_LAYOUT);
  const [layoutHydrated, setLayoutHydrated] = useState(false);

  useEffect(() => {
    setLayout(readEditorLayout());
    setLayoutHydrated(true);
  }, []);

  useEffect(() => {
    if (!layoutHydrated) return;
    window.localStorage.setItem(EDITOR_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  }, [layout, layoutHydrated]);

  const handleLayoutChange = useCallback((mode: ResizeMode, startValue: number, deltaX: number, deltaY: number) => {
    setLayout((current) => ({
      ...current,
      [mode]: clampEditorLayoutValue(
        mode,
        startValue + (mode === "timelineHeight" ? -deltaY : mode === "sidebarWidth" ? deltaX : -deltaX),
      ),
    }));
  }, []);

  const resetLayoutValue = useCallback((mode: ResizeMode) => {
    setLayout((current) => ({ ...current, [mode]: DEFAULT_EDITOR_LAYOUT[mode] }));
  }, []);

  const editorLayoutStyle = {
    "--editor-left-w": `${layout.sidebarWidth}px`,
    "--editor-right-w": `${layout.inspectorWidth}px`,
    "--editor-timeline-h": `${layout.timelineHeight}px`,
  } as CSSProperties;

  return (
    <EditorProviders
      initialDocument={initialDocument}
      projectRef={projectRef}
      initialRevisionNo={initialRevisionNo}
    >
      <EditorKeyboardBridge />
      <div
        data-surface="editor"
        data-testid="editor-shell"
        className={`${editorGridClass} editor-shell-grid`}
        style={editorLayoutStyle}
      >
        <EditorHeader />
        <Sidebar projectRef={projectRef} />
        <StageViewport />
        <TimelineShell />
        <InspectorShell />
        <PlaybackDebugPanel />
        <EditorLayoutResizers
          layout={layout}
          onChange={handleLayoutChange}
          onReset={resetLayoutValue}
        />
      </div>
    </EditorProviders>
  );
}
