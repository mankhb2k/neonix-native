"use client";

import { useState } from "react";
import { Plus, Grid } from "lucide-react";
import {
  PropertySection,
  PropertyIconButton,
  ColorPropertyInput,
} from "@/components/ui";

export interface FillLayer {
  id: string;
  color: string;
  opacity: number;
  visible: boolean;
}

export interface FillSectionProps {
  fills?: FillLayer[];
  showInExport?: boolean;
  isMixedContent?: boolean;
  onChangeFills?: (fills: FillLayer[]) => void;
  onChangeShowInExport?: (show: boolean) => void;
  disabled?: boolean;
}

export function FillSection({
  fills = [{ id: "1", color: "#FFFFFF", opacity: 100, visible: true }],
  showInExport = true,
  isMixedContent = false,
  onChangeFills,
  onChangeShowInExport,
  disabled = false,
}: FillSectionProps) {
  const [keyframeState, setKeyframeState] = useState<Record<string, boolean>>({});

  const toggleKeyframe = (id: string) => {
    setKeyframeState((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddFill = () => {
    const newFill: FillLayer = {
      id: String(Date.now()),
      color: "#3B82F6",
      opacity: 100,
      visible: true,
    };
    onChangeFills?.([...fills, newFill]);
  };

  const handleUpdateFill = (id: string, patch: Partial<FillLayer>) => {
    onChangeFills?.(
      fills.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  };

  const handleDeleteFill = (id: string) => {
    if (fills.length <= 1) return;
    onChangeFills?.(fills.filter((f) => f.id !== id));
  };

  return (
    <PropertySection
      title="Fill"
      action={
        <div className="flex items-center gap-0.5">
          <PropertyIconButton label="Quản lý Style Library">
            <Grid size={13} />
          </PropertyIconButton>
          <PropertyIconButton label="Thêm lớp Fill" onClick={handleAddFill}>
            <Plus size={14} />
          </PropertyIconButton>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        {isMixedContent ? (
          <p className="text-caption italic text-[var(--fg-muted)]">
            Click + to replace mixed content
          </p>
        ) : (
          fills.map((fill) => (
            <ColorPropertyInput
              key={fill.id}
              value={fill.color}
              opacity={fill.opacity}
              onChange={(color) => handleUpdateFill(fill.id, { color })}
              onChangeOpacity={(opacity) => handleUpdateFill(fill.id, { opacity })}
              keyframeable
              isKeyframed={keyframeState[fill.id]}
              onToggleKeyframe={() => toggleKeyframe(fill.id)}
              visible={fill.visible}
              onToggleVisibility={() =>
                handleUpdateFill(fill.id, { visible: !fill.visible })
              }
              onDelete={fills.length > 1 ? () => handleDeleteFill(fill.id) : undefined}
              disabled={disabled}
            />
          ))
        )}

        {/* Checkbox Show in exports */}
        <label className="flex items-center gap-2 pt-1 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={showInExport}
            disabled={disabled}
            onChange={(e) => onChangeShowInExport?.(e.target.checked)}
            className="size-3.5 rounded border border-white/20 bg-[var(--bg-hover)] accent-[var(--accent,#3B82F6)] cursor-pointer"
          />
          <span className="text-caption text-[var(--fg)]">Show in exports</span>
        </label>
      </div>
    </PropertySection>
  );
}
