"use client";

import { useEditorStore } from "@/lib/store/editor-store";

export function Timeline() {
  const project = useEditorStore((s) => s.project);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectScene = useEditorStore((s) => s.selectScene);

  if (!project) return null;

  const total = project.scenes.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="mv-timeline">
      <div className="mv-timeline-head">
        <strong>Timeline</strong>
        <span style={{ color: "var(--fg-muted)", fontSize: "0.8rem" }}>
          Tổng {total}s
        </span>
      </div>
      <div className="mv-timeline-track">
        {project.scenes.map((scene, index) => (
          <button
            key={scene.id}
            type="button"
            className={`mv-timeline-block${selectedSceneId === scene.id ? " is-active" : ""}`}
            style={{ flexBasis: `${Math.max(88, scene.duration * 28)}px` }}
            onClick={() => selectScene(scene.id)}
          >
            <strong>
              {index + 1}. {scene.role ?? scene.id}
            </strong>
            <span>{scene.duration}s</span>
          </button>
        ))}
      </div>
    </div>
  );
}
