"use client";

import { useEditorStore } from "@/lib/store/editor-store";

export function SceneRail() {
  const project = useEditorStore((s) => s.project);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectScene = useEditorStore((s) => s.selectScene);
  const selectLayer = useEditorStore((s) => s.selectLayer);

  if (!project) return null;

  const scene = project.scenes.find((s) => s.id === selectedSceneId);

  return (
    <aside className="mv-rail">
      <div className="mv-rail-section">
        <p className="mv-rail-label">Scenes</p>
        <ul className="mv-scene-list">
          {project.scenes.map((s, index) => (
            <li key={s.id}>
              <button
                type="button"
                className={`mv-scene-item${selectedSceneId === s.id ? " is-active" : ""}`}
                onClick={() => selectScene(s.id)}
              >
                <strong>
                  {index + 1}. {s.role ?? s.id}
                </strong>
                <span>{s.duration}s · {s.layers.length} layer</span>
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
    </aside>
  );
}
