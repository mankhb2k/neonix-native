"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useEditorStore } from "@/lib/editor/editor-store";
import {
  selectSelectedNodeId,
  selectSelectedSceneId,
} from "@/lib/editor/model/editor-selectors";
import { listMotionBlocksByFamily } from "@motionvideo/template-library";
import {
  PanelHeader,
  TabsDesktop,
  type DesktopTabItem,
  PropertySection,
  PropertyRow,
  PropertyInput,
  PropertySelect,
  PropertyIconButton,
} from "@/components/ui";

import { InspectorHeader } from "./components/InspectorHeader";
import { AlignmentSection } from "./sections/AlignmentSection";
import { TransformSection } from "./sections/TransformSection";
import { LayoutSection } from "./sections/LayoutSection";
import { TextSection } from "./sections/TextSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { FillSection, type FillLayer } from "./sections/FillSection";
import { StrokeSection, type StrokeLayer } from "./sections/StrokeSection";
import { AudioSection } from "./sections/AudioSection";
import { SpeedSection } from "./sections/SpeedSection";
import { ColorGradingSection } from "./sections/ColorGradingSection";

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

interface NodeInspectorState {
  opacity: number;
  cornerRadius: number;
  corners: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
  rotation: number;
  scaleX: number;
  scaleY: number;
  flow: "absolute" | "flex-col" | "flex-row" | "grid";
  width: number;
  height: number;
  visible: boolean;
  showInExport: boolean;
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  textAlign: "left" | "center" | "right" | "justify";
  fills: FillLayer[];
  strokes: StrokeLayer[];
}

export function Inspector() {
  const project = useEditorStore((s) => s.project);
  const scenes = project?.scenes;
  const aspectRatio = project?.metadata.aspectRatio;
  const brand = project?.metadata.brand;
  const selection = useEditorStore((s) => s.selection);
  const timelineClips = useEditorStore((s) => s.timelineClips);
  const timelineLanes = useEditorStore((s) => s.timelineLanes);

  const selectedSceneId = selectSelectedSceneId(
    selection,
    timelineClips,
    timelineLanes,
  );
  const selectedNodeId = selectSelectedNodeId(
    selection,
    timelineClips,
    timelineLanes,
    project,
  );

  const updateNodeText = useEditorStore((s) => s.updateNodeText);
  const updateNodeAnimation = useEditorStore((s) => s.updateNodeAnimation);
  const updateNodePosition = useEditorStore((s) => s.updateNodePosition);

  const [activeTab, setActiveTab] = useState("basic");

  // Local state for full design properties
  const [nodeState, setNodeState] = useState<NodeInspectorState>({
    opacity: 100,
    cornerRadius: 0,
    corners: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
    rotation: 0,
    scaleX: 100,
    scaleY: 100,
    flow: "absolute",
    width: 145.91,
    height: 330.16,
    visible: true,
    showInExport: true,
    fontFamily: "Inter",
    fontWeight: "400",
    fontSize: 16,
    lineHeight: 1.2,
    letterSpacing: 0,
    textAlign: "left",
    fills: [{ id: "1", color: "#1A5D3A", opacity: 100, visible: true }],
    strokes: [{ id: "1", color: "#000000", opacity: 100, width: 1, position: "center", visible: true }],
  });

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
  const animation = scene?.clips.find(
    (clip) => clip.targetId === node?.id && clip.source.kind === "preset",
  );
  const defaultPreset = animationBlocks[0]?.preset ?? "fade-in";

  return (
    <div className="flex h-full flex-col bg-[var(--bg-card,#171717)] text-[var(--fg,#FFF)]">
      {/* Inspector Header Breadcrumb */}
      <InspectorHeader
        nodeType={node?.type ?? "Scene"}
        nodeName={node?.name ?? (node?.type === "text" ? "Text Layer" : "Layer")}
      />

      {/* CapCut Style Inspector Header Tabs */}
      <PanelHeader className="px-0 border-b border-[var(--line,#262626)]">
        <TabsDesktop
          items={INSPECTOR_TABS}
          value={activeTab}
          onChange={setActiveTab}
        />
      </PanelHeader>

      <div className="flex-1 overflow-y-auto">
        {/* Tab 1: CƠ BẢN (Basic & Design Properties) */}
        {activeTab === "basic" ? (
          <>
            {/* Alignment Section */}
            <AlignmentSection disabled={!node} />

            {/* Transform Section */}
            <TransformSection
              disabled={!node}
              x={node?.transform.x ?? 0}
              y={node?.transform.y ?? 0}
              scaleX={nodeState.scaleX}
              scaleY={nodeState.scaleY}
              rotation={nodeState.rotation}
              onChangePosition={(pos) => {
                if (node) {
                  updateNodePosition(selectedSceneId, node.id, pos);
                }
              }}
              onChangeScale={(scale) =>
                setNodeState((prev) => ({ ...prev, ...scale }))
              }
              onChangeRotation={(deg) =>
                setNodeState((prev) => ({ ...prev, rotation: deg }))
              }
            />

            {/* Layout Section */}
            <LayoutSection
              disabled={!node}
              flow={nodeState.flow}
              width={nodeState.width}
              height={nodeState.height}
              onChangeFlow={(flow) => setNodeState((prev) => ({ ...prev, flow }))}
              onChangeDimensions={(dim) => setNodeState((prev) => ({ ...prev, ...dim }))}
            />

            {/* Text Section (render if text layer selected) */}
            {node?.type === "text" ? (
              <TextSection
                disabled={!node}
                text={typeof node.payload?.text === "string" ? node.payload.text : ""}
                fontFamily={nodeState.fontFamily}
                fontWeight={nodeState.fontWeight}
                fontSize={nodeState.fontSize}
                lineHeight={nodeState.lineHeight}
                letterSpacing={nodeState.letterSpacing}
                align={nodeState.textAlign}
                onChangeText={(text) => updateNodeText(selectedSceneId, node.id, text)}
                onChangeFont={(font) =>
                  setNodeState((prev) => ({
                    ...prev,
                    fontFamily: font.family ?? prev.fontFamily,
                    fontWeight: font.weight ?? prev.fontWeight,
                    fontSize: font.size ?? prev.fontSize,
                  }))
                }
                onChangeSpacing={(spacing) =>
                  setNodeState((prev) => ({ ...prev, ...spacing }))
                }
                onChangeAlign={(align) =>
                  setNodeState((prev) => ({ ...prev, textAlign: align }))
                }
              />
            ) : null}

            {/* Appearance Section */}
            <AppearanceSection
              disabled={!node}
              opacity={nodeState.opacity}
              cornerRadius={nodeState.cornerRadius}
              corners={nodeState.corners}
              visible={nodeState.visible}
              onChangeOpacity={(opacity) => setNodeState((prev) => ({ ...prev, opacity }))}
              onChangeCornerRadius={(radius) =>
                setNodeState((prev) => ({ ...prev, cornerRadius: radius }))
              }
              onChangeCorners={(corners) => setNodeState((prev) => ({ ...prev, corners }))}
              onToggleVisibility={() =>
                setNodeState((prev) => ({ ...prev, visible: !prev.visible }))
              }
            />

            {/* Fill Section */}
            <FillSection
              disabled={!node}
              fills={nodeState.fills}
              showInExport={nodeState.showInExport}
              onChangeFills={(fills) => setNodeState((prev) => ({ ...prev, fills }))}
              onChangeShowInExport={(show) =>
                setNodeState((prev) => ({ ...prev, showInExport: show }))
              }
            />

            {/* Stroke Section */}
            <StrokeSection
              disabled={!node}
              strokes={nodeState.strokes}
              onChangeStrokes={(strokes) => setNodeState((prev) => ({ ...prev, strokes }))}
            />
          </>
        ) : null}

        {/* Tab 2: ÂM THANH (Audio) */}
        {activeTab === "audio" ? <AudioSection disabled={!node} /> : null}

        {/* Tab 3: TỐC ĐỘ (Speed) */}
        {activeTab === "speed" ? <SpeedSection disabled={!node} /> : null}

        {/* Tab 4: HOẠT HÌNH (Animation Presets & Timing) */}
        {activeTab === "animation" ? (
          <PropertySection
            title="Preset Hoạt hình"
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
                disabled={!node}
                value={
                  animation?.source.kind === "preset"
                    ? animation.source.presetId
                    : defaultPreset
                }
                onChange={(e) =>
                  node &&
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
                  label="Thời lượng"
                  prefix="s"
                  type="number"
                  min={0.1}
                  step={0.1}
                  stepper
                  disabled={!node}
                  value={animation?.duration ?? 0.6}
                  onChange={(e) =>
                    node &&
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
                  disabled={!node}
                  value={
                    animation?.schedule.kind === "absolute"
                      ? animation.schedule.at
                      : 0
                  }
                  onChange={(e) =>
                    node &&
                    updateNodeAnimation(selectedSceneId, node.id, {
                      at: Number(e.target.value),
                    })
                  }
                />
              </PropertyRow>
            </div>
          </PropertySection>
        ) : null}

        {/* Tab 5: ĐIỀU CHỈNH (Adjust / Color Grading) */}
        {activeTab === "adjust" ? <ColorGradingSection disabled={!node} /> : null}

        {/* Tab 6: PHONG CÁCH AI (AI Style) */}
        {activeTab === "ai" ? (
          <div className="p-4 text-center text-caption text-[var(--fg-muted)]">
            Bộ công cụ AI Smart Relighting & Style Transfer sẽ sớm ra mắt.
          </div>
        ) : null}
      </div>
    </div>
  );
}
