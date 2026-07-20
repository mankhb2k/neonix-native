"use client";

import { AnimationPresetSchema } from "@motionvideo/motion-schema";
import { useEditorStore } from "@/lib/store/editor-store";

const presets = AnimationPresetSchema.options;

export function Inspector() {
  const project = useEditorStore((s) => s.project);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const updateBrand = useEditorStore((s) => s.updateBrand);
  const updateLayerContent = useEditorStore((s) => s.updateLayerContent);
  const updateLayerAnimation = useEditorStore((s) => s.updateLayerAnimation);
  const updateSceneDuration = useEditorStore((s) => s.updateSceneDuration);
  const setAspectRatio = useEditorStore((s) => s.setAspectRatio);

  if (!project || !selectedSceneId) return null;

  const scene = project.scenes.find((s) => s.id === selectedSceneId);
  const layer = scene?.layers.find((l) => l.id === selectedLayerId);
  const animation = layer?.animations[0];

  return (
    <div className="mv-inspector">
      <div className="mv-field">
        <label htmlFor="brand-name">Brand</label>
        <input
          id="brand-name"
          value={project.brand.name}
          onChange={(e) => updateBrand({ name: e.target.value })}
        />
      </div>
      <div className="mv-field">
        <label htmlFor="brand-color">Màu brand</label>
        <input
          id="brand-color"
          type="color"
          value={project.brand.primaryColor ?? "#1A5D3A"}
          onChange={(e) => updateBrand({ primaryColor: e.target.value })}
        />
      </div>
      <div className="mv-field">
        <label htmlFor="aspect">Tỉ lệ</label>
        <select
          id="aspect"
          value={project.aspectRatio}
          onChange={(e) =>
            setAspectRatio(e.target.value as typeof project.aspectRatio)
          }
        >
          <option value="9:16">9:16 dọc</option>
          <option value="16:9">16:9 ngang</option>
          <option value="1:1">1:1 vuông</option>
        </select>
      </div>
      <div className="mv-field">
        <label htmlFor="duration">Thời lượng scene (s)</label>
        <input
          id="duration"
          type="number"
          min={0.5}
          step={0.5}
          value={scene?.duration ?? 1}
          onChange={(e) =>
            updateSceneDuration(selectedSceneId, Number(e.target.value))
          }
        />
      </div>
      {layer?.type === "text" ? (
        <div className="mv-field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="layer-text">Chữ layer</label>
          <input
            id="layer-text"
            value={layer.content ?? ""}
            onChange={(e) =>
              updateLayerContent(selectedSceneId, layer.id, e.target.value)
            }
          />
        </div>
      ) : null}
      {layer ? (
        <div className="mv-field">
          <label htmlFor="anim">Animation</label>
          <select
            id="anim"
            value={animation?.preset ?? "fade"}
            onChange={(e) =>
              updateLayerAnimation(
                selectedSceneId,
                layer.id,
                e.target.value as (typeof presets)[number],
              )
            }
          >
            {presets.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
