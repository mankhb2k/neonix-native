"use client";

import { useEditorStore } from "@/lib/store/editor-store";
import { listMotionBlocksByFamily } from "@motionvideo/template-library";

const animationBlocks = listMotionBlocksByFamily("animation").filter((b) =>
  Boolean(b.preset),
);

export function Inspector() {
  const project = useEditorStore((s) => s.project);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const updateBrand = useEditorStore((s) => s.updateBrand);
  const updateLayerContent = useEditorStore((s) => s.updateLayerContent);
  const updateLayerAnimation = useEditorStore((s) => s.updateLayerAnimation);
  const updateLayerPosition = useEditorStore((s) => s.updateLayerPosition);
  const updateSceneDuration = useEditorStore((s) => s.updateSceneDuration);
  const setAspectRatio = useEditorStore((s) => s.setAspectRatio);

  if (!project || !selectedSceneId) {
    return (
      <div className="mv-tool-empty">
        <p>Chọn một scene hoặc layer để chỉnh.</p>
      </div>
    );
  }

  const scene = project.scenes.find((s) => s.id === selectedSceneId);
  const layer = scene?.layers.find((l) => l.id === selectedLayerId);
  const animation = layer?.animations[0];
  const defaultPreset = animationBlocks[0]?.preset ?? "fade-in";

  return (
    <div className="mv-inspector is-stack">
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
        <div className="mv-field">
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
        <>
          <div className="mv-field">
            <label htmlFor="layer-x">X</label>
            <input
              id="layer-x"
              type="number"
              step={1}
              value={layer.x}
              onChange={(e) =>
                updateLayerPosition(selectedSceneId, layer.id, {
                  x: Number(e.target.value),
                })
              }
            />
          </div>
          <div className="mv-field">
            <label htmlFor="layer-y">Y</label>
            <input
              id="layer-y"
              type="number"
              step={1}
              value={layer.y}
              onChange={(e) =>
                updateLayerPosition(selectedSceneId, layer.id, {
                  y: Number(e.target.value),
                })
              }
            />
          </div>
          <div className="mv-field">
            <label htmlFor="anim">Animation</label>
            <select
              id="anim"
              value={animation?.preset ?? defaultPreset}
              onChange={(e) =>
                updateLayerAnimation(selectedSceneId, layer.id, {
                  preset: e.target.value,
                })
              }
            >
              {animationBlocks.map((b) => (
                <option key={b.id} value={b.preset!}>
                  {b.nameVi}
                </option>
              ))}
            </select>
          </div>
          <div className="mv-field">
            <label htmlFor="anim-dur">Anim duration (s)</label>
            <input
              id="anim-dur"
              type="number"
              min={0.1}
              step={0.1}
              value={animation?.duration ?? 0.6}
              onChange={(e) =>
                updateLayerAnimation(selectedSceneId, layer.id, {
                  duration: Number(e.target.value),
                })
              }
            />
          </div>
          <div className="mv-field">
            <label htmlFor="anim-delay">Anim delay (s)</label>
            <input
              id="anim-delay"
              type="number"
              min={0}
              step={0.1}
              value={animation?.delay ?? 0}
              onChange={(e) =>
                updateLayerAnimation(selectedSceneId, layer.id, {
                  delay: Number(e.target.value),
                })
              }
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
