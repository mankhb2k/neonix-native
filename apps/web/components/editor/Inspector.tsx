"use client";

import { Plus, Eye } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";
import { listMotionBlocksByFamily } from "@motionvideo/template-library";
import {
  PropertySection,
  PropertyRow,
  PropertyInput,
  PropertySelect,
  PropertyColor,
  PropertyIconButton,
} from "@/components/ui";

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
      <div className="flex flex-1 items-center justify-center px-4 text-center text-ui text-[var(--fg-muted)]">
        Chọn một khung hình hoặc layer để chỉnh.
      </div>
    );
  }

  const scene = project.scenes.find((s) => s.id === selectedSceneId);
  const layer = scene?.layers.find((l) => l.id === selectedLayerId);
  const animation = layer?.animations[0];
  const defaultPreset = animationBlocks[0]?.preset ?? "fade-in";
  const layerTitle =
    layer?.type === "text"
      ? "Văn bản"
      : layer
        ? layer.type.charAt(0).toUpperCase() + layer.type.slice(1)
        : scene?.role
          ? `Khung · ${scene.role}`
          : "Khung hình";

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex h-10 shrink-0 items-center border-b border-[var(--line)] px-3">
        <span className="truncate text-body font-semibold text-[var(--fg)]">
          {layerTitle}
        </span>
      </div>

      <PropertySection title="Vị trí">
        <PropertyRow>
          <PropertyInput
            id="layer-x"
            prefix="X"
            type="number"
            step={1}
            stepper
            disabled={!layer}
            value={layer?.x ?? 0}
            onChange={(e) =>
              layer &&
              updateLayerPosition(selectedSceneId, layer.id, {
                x: Number(e.target.value),
              })
            }
          />
          <PropertyInput
            id="layer-y"
            prefix="Y"
            type="number"
            step={1}
            stepper
            disabled={!layer}
            value={layer?.y ?? 0}
            onChange={(e) =>
              layer &&
              updateLayerPosition(selectedSceneId, layer.id, {
                y: Number(e.target.value),
              })
            }
          />
        </PropertyRow>
      </PropertySection>

      <PropertySection title="Bố cục">
        <PropertyRow>
          <PropertyInput
            id="duration"
            label="Thời lượng"
            prefix="s"
            type="number"
            min={0.5}
            step={0.5}
            stepper
            value={scene?.duration ?? 1}
            onChange={(e) =>
              updateSceneDuration(selectedSceneId, Number(e.target.value))
            }
          />
          <PropertySelect
            id="aspect"
            label="Tỉ lệ"
            value={project.aspectRatio}
            onChange={(e) =>
              setAspectRatio(e.target.value as typeof project.aspectRatio)
            }
          >
            <option value="9:16">9:16</option>
            <option value="16:9">16:9</option>
            <option value="1:1">1:1</option>
          </PropertySelect>
        </PropertyRow>
      </PropertySection>

      <PropertySection
        title="Giao diện"
        action={
          <PropertyIconButton label="Hiện / ẩn">
            <Eye size={14} strokeWidth={1.5} />
          </PropertyIconButton>
        }
      >
        <div className="flex flex-col gap-2">
          <PropertyInput
            id="brand-name"
            label="Brand"
            value={project.brand.name}
            onChange={(e) => updateBrand({ name: e.target.value })}
          />
          <PropertyColor
            id="brand-color"
            label="Màu brand"
            value={project.brand.primaryColor ?? "#1A5D3A"}
            onChange={(value) => updateBrand({ primaryColor: value })}
          />
        </div>
      </PropertySection>

      {layer?.type === "text" ? (
        <PropertySection
          title="Chữ"
          action={
            <PropertyIconButton label="Thêm">
              <Plus size={14} strokeWidth={1.5} />
            </PropertyIconButton>
          }
        >
          <PropertyInput
            id="layer-text"
            value={layer.content ?? ""}
            onChange={(e) =>
              updateLayerContent(selectedSceneId, layer.id, e.target.value)
            }
          />
        </PropertySection>
      ) : null}

      {layer ? (
        <PropertySection
          title="Hoạt hình"
          action={
            <PropertyIconButton label="Thêm">
              <Plus size={14} strokeWidth={1.5} />
            </PropertyIconButton>
          }
        >
          <div className="flex flex-col gap-2">
            <PropertySelect
              id="anim"
              label="Preset"
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
            </PropertySelect>
            <PropertyRow>
              <PropertyInput
                id="anim-dur"
                label="Duration"
                prefix="s"
                type="number"
                min={0.1}
                step={0.1}
                stepper
                value={animation?.duration ?? 0.6}
                onChange={(e) =>
                  updateLayerAnimation(selectedSceneId, layer.id, {
                    duration: Number(e.target.value),
                  })
                }
              />
              <PropertyInput
                id="anim-delay"
                label="Delay"
                prefix="s"
                type="number"
                min={0}
                step={0.1}
                stepper
                value={animation?.delay ?? 0}
                onChange={(e) =>
                  updateLayerAnimation(selectedSceneId, layer.id, {
                    delay: Number(e.target.value),
                  })
                }
              />
            </PropertyRow>
          </div>
        </PropertySection>
      ) : null}
    </div>
  );
}
