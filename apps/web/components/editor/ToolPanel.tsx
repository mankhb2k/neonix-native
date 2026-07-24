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
      brandName: project?.metadata.brand.name ?? tpl.project.metadata.brand.name,
      industry: tpl.industry,
      templateId: tpl.id,
      aspectRatio: project?.metadata.aspectRatio ?? tpl.aspectRatio,
      primaryColor: project?.metadata.brand.primaryColor,
      script: tpl.project.scenes
        .flatMap((scene) => scene.nodes.map((node) => node.type === "text" && typeof node.payload?.text === "string" ? node.payload.text : ""))
        .filter(Boolean)
        .join("\n"),
    });
    const withId = project ? { ...next, metadata: { ...next.metadata, id: project.metadata.id } } : next;
    saveProject(withId);
    loadProject(withId);
    if (!project) {
      router.push(appHref(`/editor/${withId.metadata.id}`));
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
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const selectScene = useEditorStore((s) => s.selectScene);
  const selectNode = useEditorStore((s) => s.selectNode);

  const scene = project?.scenes.find((s) => s.id === selectedSceneId);

  const titles: Record<EditorTool, string> = {
    scenes: "Cảnh & Node",
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
                      {index + 1}. {s.semantic?.role ?? s.name ?? s.id}
                    </strong>
                    <span>
                      {s.duration}s · {s.nodes.length} node
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <p className="mv-rail-label" style={{ padding: "0.75rem 0.85rem 0" }}>
            Nodes
          </p>
          <ul className="mv-layer-list">
            {scene?.nodes.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  className={`mv-layer-item${selectedNodeId === node.id ? " is-active" : ""}`}
                  onClick={() => selectNode(node.id)}
                >
                  <span>{node.type === "text" && typeof node.payload?.text === "string" ? node.payload.text : node.id}</span>
                  <span>{node.type}</span>
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
