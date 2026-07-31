import type { CSSProperties, ReactNode } from "react";
import { usePanelResize } from "./use-panel-resize";
import "./editor-workspace-layout.css";

type Props = {
  showInspector: boolean;
  sidebar: ReactNode;
  stage: ReactNode;
  timeline: ReactNode;
  inspector?: ReactNode;
};

export function EditorWorkspaceLayout({
  showInspector,
  sidebar,
  stage,
  timeline,
  inspector,
}: Props) {
  const { layout, beginResize } = usePanelResize();

  return (
    <div
      className={
        showInspector
          ? "editor-layout editor-layout--with-inspector"
          : "editor-layout"
      }
      style={
        {
          "--sidebar-w": `${layout.sidebarWidth}px`,
          "--inspector-w": `${layout.inspectorWidth}px`,
          "--timeline-h": `${layout.timelineHeight}px`,
        } as CSSProperties
      }
    >
      <div className="editor-layout__sidebar">{sidebar}</div>
      <div
        className="editor-layout__resize editor-layout__resize--v"
        onPointerDown={(e) => beginResize("sidebar", e)}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
      />
      <div className="editor-layout__center">
        <div className="editor-layout__stage">{stage}</div>
        <div
          className="editor-layout__resize editor-layout__resize--h"
          onPointerDown={(e) => beginResize("timeline", e)}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize timeline"
        />
        <div className="editor-layout__timeline">{timeline}</div>
      </div>
      {showInspector ? (
        <>
          <div
            className="editor-layout__resize editor-layout__resize--v"
            onPointerDown={(e) => beginResize("inspector", e)}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize inspector"
          />
          <div className="editor-layout__inspector">{inspector}</div>
        </>
      ) : null}
    </div>
  );
}
