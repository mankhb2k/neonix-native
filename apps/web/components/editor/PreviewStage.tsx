"use client";

import { useEditorStore } from "@/lib/store/editor-store";

export function PreviewStage() {
  const project = useEditorStore((s) => s.project);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);

  if (!project) {
    return (
      <div className="mv-preview-wrap">
        <p style={{ color: "var(--fg-muted)" }}>Chưa có dự án</p>
      </div>
    );
  }

  const scene =
    project.scenes.find((s) => s.id === selectedSceneId) ?? project.scenes[0];
  const textLayers = scene.layers.filter((l) => l.type === "text");
  const primaryText = textLayers[0]?.content ?? project.brand.name;
  const secondaryText = textLayers[1]?.content;
  const accent = project.brand.primaryColor ?? "#3f9a62";

  return (
    <div className="mv-preview-wrap">
      <div
        className="mv-stage"
        data-ratio={project.aspectRatio}
        style={{ ["--stage-accent" as string]: accent }}
        key={scene.id}
      >
        <div className="mv-stage-brand">
          <div className="mv-stage-logo" />
          <span>{project.brand.name}</span>
        </div>
        <div className="mv-stage-role">{scene.role ?? scene.id}</div>
        <div className="mv-stage-text">{primaryText}</div>
        {secondaryText ? (
          <div className="mv-stage-sub">{secondaryText}</div>
        ) : null}
      </div>
    </div>
  );
}
