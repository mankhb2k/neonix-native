"use client";

import { useState } from "react";
import { Plus, Grid } from "lucide-react";
import {
  PropertySection,
  PropertyIconButton,
  ColorPropertyInput,
  PropertyInput,
  PropertySelect,
} from "@/components/ui";

export interface StrokeLayer {
  id: string;
  color: string;
  opacity: number;
  width: number;
  position: "inside" | "center" | "outside";
  visible: boolean;
}

export interface StrokeSectionProps {
  strokes?: StrokeLayer[];
  onChangeStrokes?: (strokes: StrokeLayer[]) => void;
  disabled?: boolean;
}

export function StrokeSection({
  strokes = [{ id: "1", color: "#000000", opacity: 100, width: 1, position: "center", visible: true }],
  onChangeStrokes,
  disabled = false,
}: StrokeSectionProps) {
  const [keyframeState, setKeyframeState] = useState<Record<string, boolean>>({});

  const toggleKeyframe = (id: string) => {
    setKeyframeState((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddStroke = () => {
    const newStroke: StrokeLayer = {
      id: String(Date.now()),
      color: "#000000",
      opacity: 100,
      width: 1,
      position: "center",
      visible: true,
    };
    onChangeStrokes?.([...strokes, newStroke]);
  };

  const handleUpdateStroke = (id: string, patch: Partial<StrokeLayer>) => {
    onChangeStrokes?.(
      strokes.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const handleDeleteStroke = (id: string) => {
    if (strokes.length <= 1) return;
    onChangeStrokes?.(strokes.filter((s) => s.id !== id));
  };

  return (
    <PropertySection
      title="Stroke"
      action={
        <div className="flex items-center gap-0.5">
          <PropertyIconButton label="Quản lý Style Library">
            <Grid size={13} />
          </PropertyIconButton>
          <PropertyIconButton label="Thêm lớp Stroke" onClick={handleAddStroke}>
            <Plus size={14} />
          </PropertyIconButton>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        {strokes.map((stroke) => (
          <div key={stroke.id} className="flex flex-col gap-1.5">
            <ColorPropertyInput
              value={stroke.color}
              opacity={stroke.opacity}
              onChange={(color) => handleUpdateStroke(stroke.id, { color })}
              onChangeOpacity={(opacity) => handleUpdateStroke(stroke.id, { opacity })}
              keyframeable
              isKeyframed={keyframeState[stroke.id]}
              onToggleKeyframe={() => toggleKeyframe(stroke.id)}
              visible={stroke.visible}
              onToggleVisibility={() =>
                handleUpdateStroke(stroke.id, { visible: !stroke.visible })
              }
              onDelete={strokes.length > 1 ? () => handleDeleteStroke(stroke.id) : undefined}
              disabled={disabled}
            />

            {/* Stroke Width & Position */}
            <div className="flex items-center gap-2 pl-2">
              <PropertyInput
                prefix="Viền"
                suffix="px"
                type="number"
                min={0}
                step={0.5}
                stepper
                disabled={disabled}
                value={stroke.width}
                onChange={(e) =>
                  handleUpdateStroke(stroke.id, { width: Number(e.target.value) })
                }
              />
              <PropertySelect
                value={stroke.position}
                disabled={disabled}
                onChange={(e) =>
                  handleUpdateStroke(stroke.id, {
                    position: e.target.value as StrokeLayer["position"],
                  })
                }
              >
                <option value="center">Giữa (Center)</option>
                <option value="inside">Trong (Inside)</option>
                <option value="outside">Ngoài (Outside)</option>
              </PropertySelect>
            </div>
          </div>
        ))}
      </div>
    </PropertySection>
  );
}
