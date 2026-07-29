"use client";

import { useState } from "react";
import { Plus, Eye } from "lucide-react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { listMotionBlocksByFamily } from "@motionvideo/template-library";
import {
  PanelHeader,
  TabsDesktop,
  type DesktopTabItem,
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

const INSPECTOR_TABS: DesktopTabItem[] = [
  { id: "basic", label: "Cơ bản" },
  { id: "audio", label: "Âm thanh" },
  { id: "speed", label: "Tốc độ" },
  { id: "animation", label: "Hoạt hình" },
  { id: "adjust", label: "Điều chỉnh" },
  { id: "ai", label: "Phong cách AI" },
];

export function Inspector() {
  const scenes = useEditorStore((s) => s.project?.scenes);
  const aspectRatio = useEditorStore((s) => s.project?.metadata.aspectRatio);
  const brand = useEditorStore((s) => s.project?.metadata.brand);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const updateBrand = useEditorStore((s) => s.updateBrand);
  const updateNodeText = useEditorStore((s) => s.updateNodeText);
  const updateNodeAnimation = useEditorStore((s) => s.updateNodeAnimation);
  const updateNodePosition = useEditorStore((s) => s.updateNodePosition);
  const updateSceneDuration = useEditorStore((s) => s.updateSceneDuration);
  const setAspectRatio = useEditorStore((s) => s.setAspectRatio);

  const [activeTab, setActiveTab] = useState("basic");

  if (!scenes || !selectedSceneId || !aspectRatio || !brand) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 text-center text-ui text-[var(--fg-muted)]">
        {scenes && scenes.length === 0
          ? "Kéo khung hình vào timeline để bắt đầu chỉnh."
          : "Chọn một khung hình hoặc layer để chỉnh."}
      </div>
    );
  }

  const scene = scenes.find((s) => s.id === selectedSceneId);
  const node = scene?.nodes.find((candidate) => candidate.id === selectedNodeId);
  const animation = scene?.clips.find((clip) => clip.targetId === node?.id && clip.source.kind === "preset");
  const defaultPreset = animationBlocks[0]?.preset ?? "fade-in";

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* CapCut Style Inspector Header Tabs */}
      <PanelHeader className="px-0">
        <TabsDesktop
          items={INSPECTOR_TABS}
          value={activeTab}
          onChange={setActiveTab}
        />
      </PanelHeader>

      <PropertySection title="Vị trí">
        <PropertyRow>
          <PropertyInput
            id="layer-x"
            prefix="X"
            type="number"
            step={1}
            stepper
            disabled={!node}
            value={node?.transform.x ?? 0}
            onChange={(e) =>
              node &&
              updateNodePosition(selectedSceneId, node.id, {
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
            disabled={!node}
            value={node?.transform.y ?? 0}
            onChange={(e) =>
              node &&
              updateNodePosition(selectedSceneId, node.id, {
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
            value={aspectRatio}
            onChange={(e) =>
              setAspectRatio(e.target.value as typeof aspectRatio)
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
            value={brand.name}
            onChange={(e) => updateBrand({ name: e.target.value })}
          />
          <PropertyColor
            id="brand-color"
            label="Màu brand"
            value={brand.primaryColor ?? "#1A5D3A"}
            onChange={(value) => updateBrand({ primaryColor: value })}
          />
        </div>
      </PropertySection>

      {node?.type === "text" ? (
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
            value={typeof node.payload?.text === "string" ? node.payload.text : ""}
            onChange={(e) =>
              updateNodeText(selectedSceneId, node.id, e.target.value)
            }
          />
        </PropertySection>
      ) : null}

      {node ? (
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
              value={animation?.source.kind === "preset" ? animation.source.presetId : defaultPreset}
              onChange={(e) =>
                updateNodeAnimation(selectedSceneId, node.id, {
                  presetId: e.target.value,
                })
              }
            >
              {animationBlocks.map((b) => (
                <option key={b.id} value={b.preset}>
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
                  updateNodeAnimation(selectedSceneId, node.id, {
                    duration: Number(e.target.value),
                  })
                }
              />
              <PropertyInput
                id="anim-at"
                label="Bắt đầu"
                prefix="s"
                type="number"
                min={0}
                step={0.1}
                stepper
                value={animation?.schedule.kind === "absolute" ? animation.schedule.at : 0}
                onChange={(e) =>
                  updateNodeAnimation(selectedSceneId, node.id, {
                    at: Number(e.target.value),
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
