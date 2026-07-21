"use client";

import { useEffect, useState } from "react";
import { useEditorStore } from "@/lib/store/editor-store";
import { IconNav, type EditorTool } from "./IconNav";
import { PreviewStage } from "./PreviewStage";
import { RightDock } from "./RightDock";
import { Timeline } from "./Timeline";
import { ToolPanel } from "./ToolPanel";
import { TopBar } from "./TopBar";
import type { MotionProject } from "@motionvideo/motion-schema";

type Props = {
  initialProject: MotionProject;
};

export function EditorShell({ initialProject }: Props) {
  const loadProject = useEditorStore((s) => s.loadProject);
  const project = useEditorStore((s) => s.project);
  const [tool, setTool] = useState<EditorTool>("scenes");
  const [toolsOpen, setToolsOpen] = useState(true);

  useEffect(() => {
    loadProject(initialProject);
  }, [initialProject, loadProject]);

  function handleToolChange(next: EditorTool) {
    if (next === tool && toolsOpen) {
      setToolsOpen(false);
      return;
    }
    setTool(next);
    setToolsOpen(true);
  }

  return (
    <div className={`mv-editor${toolsOpen ? "" : " is-tools-collapsed"}`}>
      <TopBar />
      <IconNav active={tool} onChange={handleToolChange} />
      <ToolPanel tool={tool} />
      <button
        type="button"
        className="mv-tools-edge-toggle"
        onClick={() => setToolsOpen((open) => !open)}
        aria-label={toolsOpen ? "Thu gọn panel phụ" : "Mở panel phụ"}
        aria-expanded={toolsOpen}
        title={toolsOpen ? "Thu gọn" : "Mở rộng"}
      >
        <span className="mv-tools-edge-toggle-chevron" aria-hidden>
          {toolsOpen ? "‹" : "›"}
        </span>
      </button>
      <div className="mv-stage-col">
        <PreviewStage />
        <Timeline />
      </div>
      <RightDock />
      {!project ? (
        <div className="mv-editor-loading">Đang tải editor…</div>
      ) : null}
    </div>
  );
}
