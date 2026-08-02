import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { RightDock } from "./inspector/RightDock";
import { Sidebar } from "./sidebar/Sidebar";
import { Stage } from "./stage/Stage";
import { Timeline } from "./timeline/Timeline";
import type {
  EditorSessionHandle,
  EditorSessionSnapshot,
} from "../app/editor/editor-session-handle";
import type { DesktopAPI } from "../../shared/ipc/contracts";

type EditingWorkspaceProps = {
  api: DesktopAPI;
  projectId: string;
  path: string | null;
  documentJson: string;
  dirty: boolean;
  error: string | null;
  saving?: boolean;
  journalEpoch?: number;
  sessionHandleRef?: MutableRefObject<EditorSessionHandle | null>;
  onDocumentChange: (json: string) => void;
  onSave: (snapshot: EditorSessionSnapshot) => void;
  onSaveAs: (snapshot: EditorSessionSnapshot) => void;
  onCloseToHome: () => void;
  onClearError: () => void;
  initialSidebarTab?: "layers" | "media";
  timelineFocus?: boolean;
};

type FrameProps = {
  showInspector?: boolean;
  sidebar: ReactNode;
  stage: ReactNode;
  timeline: ReactNode;
  inspector?: ReactNode;
};

type PanelLayoutPrefs = {
  sidebarWidth: number;
  inspectorWidth: number;
  timelineHeight: number;
};

type ResizeEdge = "sidebar" | "inspector" | "timeline";

const PANEL_LAYOUT_KEY = "motionvideo.desktop.panelLayout.v1";

const DEFAULT_PANEL_LAYOUT: PanelLayoutPrefs = {
  sidebarWidth: 260,
  inspectorWidth: 300,
  timelineHeight: 240,
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function loadPanelLayoutPrefs(): PanelLayoutPrefs {
  try {
    const raw = localStorage.getItem(PANEL_LAYOUT_KEY);
    if (!raw) return { ...DEFAULT_PANEL_LAYOUT };
    const parsed = JSON.parse(raw) as Partial<PanelLayoutPrefs>;
    return {
      sidebarWidth: clamp(
        parsed.sidebarWidth ?? DEFAULT_PANEL_LAYOUT.sidebarWidth,
        180,
        480,
      ),
      inspectorWidth: clamp(
        parsed.inspectorWidth ?? DEFAULT_PANEL_LAYOUT.inspectorWidth,
        220,
        480,
      ),
      timelineHeight: clamp(
        parsed.timelineHeight ?? DEFAULT_PANEL_LAYOUT.timelineHeight,
        160,
        560,
      ),
    };
  } catch {
    return { ...DEFAULT_PANEL_LAYOUT };
  }
}

function savePanelLayoutPrefs(prefs: PanelLayoutPrefs): void {
  try {
    localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}

function usePanelResize() {
  const [layout, setLayout] = useState<PanelLayoutPrefs>(() =>
    typeof localStorage === "undefined"
      ? { ...DEFAULT_PANEL_LAYOUT }
      : loadPanelLayoutPrefs(),
  );
  const dragRef = useRef<{
    edge: ResizeEdge;
    startX: number;
    startY: number;
    origin: PanelLayoutPrefs;
  } | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      savePanelLayoutPrefs(layout);
      persistTimerRef.current = null;
    }, 200);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [layout]);

  const onPointerMove = useCallback((ev: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = ev.clientX - drag.startX;
    const dy = ev.clientY - drag.startY;
    setLayout(() => {
      if (drag.edge === "sidebar") {
        return {
          ...drag.origin,
          sidebarWidth: clamp(drag.origin.sidebarWidth + dx, 180, 480),
        };
      }
      if (drag.edge === "inspector") {
        return {
          ...drag.origin,
          inspectorWidth: clamp(drag.origin.inspectorWidth - dx, 220, 480),
        };
      }
      return {
        ...drag.origin,
        timelineHeight: clamp(drag.origin.timelineHeight - dy, 160, 560),
      };
    });
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
  }, [onPointerMove]);

  const beginResize = useCallback(
    (edge: ResizeEdge, ev: ReactPointerEvent) => {
      ev.preventDefault();
      dragRef.current = {
        edge,
        startX: ev.clientX,
        startY: ev.clientY,
        origin: layout,
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
    },
    [endDrag, layout, onPointerMove],
  );

  useEffect(() => () => endDrag(), [endDrag]);

  return { layout, beginResize };
}

/**
 * 4-region workspace frame (slots). Prefer {@link EditingWorkspace} as the app entry.
 */
export function EditorWorkspaceFrame({
  showInspector = true,
  sidebar,
  stage,
  timeline,
  inspector,
}: FrameProps) {
  const { layout, beginResize } = usePanelResize();
  const [activeResizer, setActiveResizer] = useState<ResizeEdge | null>(null);
  const withInspector = showInspector && inspector != null;

  const startResize = (edge: ResizeEdge) => (e: ReactPointerEvent) => {
    setActiveResizer(edge);
    beginResize(edge, e);
    const onUp = () => {
      setActiveResizer(null);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      className={`grid min-h-0 flex-1 gap-2 overflow-hidden p-2 ${
        activeResizer === "sidebar" || activeResizer === "inspector"
          ? "cursor-ew-resize"
          : activeResizer === "timeline"
            ? "cursor-ns-resize"
            : ""
      }`}
      style={
        {
          gridTemplateColumns: withInspector
            ? `${layout.sidebarWidth}px minmax(0, 1fr) ${layout.inspectorWidth}px`
            : `${layout.sidebarWidth}px minmax(0, 1fr)`,
          gridTemplateRows: `minmax(0, 1fr) ${layout.timelineHeight}px`,
          gridTemplateAreas: withInspector
            ? `"sidebar stage rightDock" "timeline timeline timeline"`
            : `"sidebar stage" "timeline timeline"`,
          transition: activeResizer
            ? "none"
            : "grid-template-columns 0.15s ease-out, grid-template-rows 0.15s ease-out",
        } as CSSProperties
      }
    >
      <section
        className="relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-[var(--bg-panel)] shadow-md [grid-area:sidebar]"
        data-geometry="sidebar"
      >
        {sidebar}
        <div
          className="absolute inset-y-0 -right-2.5 z-40 w-3 touch-none cursor-ew-resize"
          onPointerDown={startResize("sidebar")}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
        />
      </section>

      <main
        className="relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-[var(--bg-panel)] shadow-md [grid-area:stage]"
        data-geometry="stage"
      >
        {stage}
      </main>

      {withInspector ? (
        <section
          className="relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-[var(--bg-panel)] shadow-md [grid-area:rightDock]"
          data-geometry="inspector"
        >
          {inspector}
          <div
            className="absolute inset-y-0 -left-2.5 z-40 w-3 touch-none cursor-ew-resize"
            onPointerDown={startResize("inspector")}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize inspector"
          />
        </section>
      ) : null}

      <section
        className="relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-[var(--bg-panel)] shadow-md [grid-area:timeline]"
        data-geometry="timeline"
      >
        {timeline}
        <div
          className="absolute inset-x-0 -top-2.5 z-40 h-3 touch-none cursor-ns-resize"
          onPointerDown={startResize("timeline")}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize timeline"
        />
      </section>
    </div>
  );
}

/** @deprecated Use {@link EditorWorkspaceFrame} */
export const EditorWorkspaceLayout = EditorWorkspaceFrame;

/**
 * Editor workspace shell — single entry for DesktopApp.
 * Regions: Sidebar | Stage | RightDock / Timeline (full width).
 */
export function EditingWorkspace({
  projectId,
  path,
  error,
  timelineFocus,
  onClearError,
}: EditingWorkspaceProps) {
  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--bg-app)] text-[var(--fg-primary)] select-none"
      data-project-id={projectId}
      data-editor-path={path ?? undefined}
    >
      {error ? (
        <p
          className="m-0 border-b border-[var(--danger)] bg-[var(--bg-panel)] px-4 py-2 text-[12px] text-[var(--danger)]"
          role="alert"
        >
          {error}{" "}
          <button type="button" className="underline" onClick={onClearError}>
            Dismiss
          </button>
        </p>
      ) : null}

      <EditorWorkspaceFrame
        showInspector
        sidebar={<Sidebar />}
        stage={<Stage />}
        inspector={<RightDock />}
        timeline={<Timeline focus={timelineFocus} />}
      />
    </div>
  );
}
