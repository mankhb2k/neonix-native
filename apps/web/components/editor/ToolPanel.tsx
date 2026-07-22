"use client";

import { useRouter } from "next/navigation";
import { appHref } from "@/components/AppLink";
import { saveProject } from "@/lib/project-storage";
import { useEditorStore } from "@/lib/store/editor-store";
import { planMotionProject } from "@motionvideo/ai-planner";
import { templates } from "@motionvideo/template-library";
import type { EditorTool } from "./IconNav";

type Props = {
  tool: EditorTool;
};

function TemplatePickerPanel() {
  const router = useRouter();
  const project = useEditorStore((s) => s.project);
  const loadProject = useEditorStore((s) => s.loadProject);

  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const next = planMotionProject({
      brandName: project?.brand.name ?? tpl.project.brand.name,
      industry: tpl.industry,
      templateId: tpl.id,
      aspectRatio: project?.aspectRatio ?? tpl.aspectRatio,
      primaryColor: project?.brand.primaryColor,
      script: tpl.project.scenes
        .flatMap((s) => s.layers.map((l) => l.content ?? ""))
        .filter(Boolean)
        .join("\n"),
    });
    const withId = project ? { ...next, id: project.id } : next;
    saveProject(withId);
    loadProject(withId);
    if (!project) {
      router.push(appHref(`/editor/${withId.id}`));
    }
  }

  return (
    <div className="mv-rail-section">
      <p className="mv-rail-label">Chọn mẫu</p>
      <ul className="mv-scene-list">
        {templates.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className="mv-scene-item"
              onClick={() => applyTemplate(t.id)}
            >
              <strong>{t.name}</strong>
              <span>
                {t.industry} · {t.duration}s · {t.aspectRatio}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ToolPanel({ tool }: Props) {
  const project = useEditorStore((s) => s.project);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectScene = useEditorStore((s) => s.selectScene);
  const selectLayer = useEditorStore((s) => s.selectLayer);

  const scene = project?.scenes.find((s) => s.id === selectedSceneId);

  const titles: Record<EditorTool, string> = {
    scenes: "Cảnh & Layer",
    templates: "Mẫu",
    text: "Văn bản",
    audio: "Âm thanh",
    effects: "Hiệu ứng",
  };

  return (
    <aside className="mv-tool-panel" aria-label={titles[tool]}>
      <div className="mv-tool-panel-head">
        <h2>{titles[tool]}</h2>
      </div>

      {tool === "scenes" ? (
        <>
          <div className="mv-rail-section">
            <p className="mv-rail-label">Scenes</p>
            <ul className="mv-scene-list">
              {(project?.scenes ?? []).map((s, index) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`mv-scene-item${selectedSceneId === s.id ? " is-active" : ""}`}
                    onClick={() => selectScene(s.id)}
                  >
                    <strong>
                      {index + 1}. {s.role ?? s.id}
                    </strong>
                    <span>
                      {s.duration}s · {s.layers.length} layer
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <p className="mv-rail-label" style={{ padding: "0.75rem 0.85rem 0" }}>
            Layers
          </p>
          <ul className="mv-layer-list">
            {scene?.layers.map((layer) => (
              <li key={layer.id}>
                <button
                  type="button"
                  className={`mv-layer-item${selectedLayerId === layer.id ? " is-active" : ""}`}
                  onClick={() => selectLayer(layer.id)}
                >
                  <span>{layer.content || layer.id}</span>
                  <span>{layer.type}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {tool === "templates" ? <TemplatePickerPanel /> : null}

      {tool !== "scenes" && tool !== "templates" ? (
        <div className="mv-tool-empty">
          <p>Sắp có — dùng tab Cảnh / Mẫu cho MVP.</p>
        </div>
      ) : null}
    </aside>
  );
}
