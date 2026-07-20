"use client";

import { useEffect } from "react";
import type { MotionProject } from "@motionvideo/motion-schema";
import { useEditorStore } from "@/lib/store/editor-store";
import { TopBar } from "./TopBar";
import { SceneRail } from "./SceneRail";
import { PreviewStage } from "./PreviewStage";
import { Inspector } from "./Inspector";
import { Timeline } from "./Timeline";
import { ChatDock } from "./ChatDock";

type Props = {
  initialProject: MotionProject;
};

export function EditorShell({ initialProject }: Props) {
  const loadProject = useEditorStore((s) => s.loadProject);
  const project = useEditorStore((s) => s.project);

  useEffect(() => {
    loadProject(initialProject);
  }, [initialProject, loadProject]);

  return (
    <div className="mv-editor">
      <TopBar />
      <div className="mv-workspace">
        <SceneRail />
        <div className="mv-center">
          <PreviewStage />
          <Inspector />
          <Timeline />
        </div>
        <ChatDock />
      </div>
      {!project ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.4)",
          }}
        >
          Đang tải editor…
        </div>
      ) : null}
    </div>
  );
}
