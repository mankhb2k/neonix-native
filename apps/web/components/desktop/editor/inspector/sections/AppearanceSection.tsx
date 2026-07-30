"use client";

import { useState } from "react";
import { Eye, Droplet, Maximize } from "lucide-react";
import {
  PropertySection,
  PropertyRow,
  PropertyInput,
  PropertyIconButton,
} from "@/components/ui";

export interface AppearanceSectionProps {
  opacity?: number;
  cornerRadius?: number;
  corners?: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
  visible?: boolean;
  onChangeOpacity?: (opacity: number) => void;
  onChangeCornerRadius?: (radius: number) => void;
  onChangeCorners?: (corners: {
    topLeft: number;
    topRight: number;
    bottomRight: number;
    bottomLeft: number;
  }) => void;
  onToggleVisibility?: () => void;
  disabled?: boolean;
}

export function AppearanceSection({
  opacity = 100,
  cornerRadius = 0,
  corners = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
  visible = true,
  onChangeOpacity,
  onChangeCornerRadius,
  onChangeCorners,
  onToggleVisibility,
  disabled = false,
}: AppearanceSectionProps) {
  const [expandCorners, setExpandCorners] = useState(false);
  const [keyframeState, setKeyframeState] = useState<Record<string, boolean>>({});

  const toggleKeyframe = (key: string) => {
    setKeyframeState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <PropertySection
      title="Appearance"
      action={
        <div className="flex items-center gap-1">
          <PropertyIconButton
            label="Ẩn / Hiện Layer"
            active={!visible}
            onClick={onToggleVisibility}
          >
            <Eye size={14} strokeWidth={1.5} />
          </PropertyIconButton>
          <PropertyIconButton label="Chế độ hòa trộn (Blend Mode)">
            <Droplet size={14} strokeWidth={1.5} />
          </PropertyIconButton>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <PropertyRow>
          {/* Opacity Input */}
          <PropertyInput
            id="appearance-opacity"
            label="Opacity"
            suffix="%"
            type="number"
            min={0}
            max={100}
            step={1}
            stepper
            disabled={disabled}
            value={opacity}
            keyframeable
            isKeyframed={keyframeState.opacity}
            onToggleKeyframe={() => toggleKeyframe("opacity")}
            onChange={(e) => onChangeOpacity?.(Number(e.target.value))}
          />

          {/* Corner Radius Input */}
          <PropertyInput
            id="appearance-radius"
            label="Corner radius"
            type="number"
            min={0}
            step={1}
            stepper
            disabled={disabled}
            value={cornerRadius}
            keyframeable
            isKeyframed={keyframeState.radius}
            onToggleKeyframe={() => toggleKeyframe("radius")}
            onChange={(e) => {
              const val = Number(e.target.value);
              onChangeCornerRadius?.(val);
              onChangeCorners?.({
                topLeft: val,
                topRight: val,
                bottomRight: val,
                bottomLeft: val,
              });
            }}
          />

          {/* Individual 4 Corners Toggle Button */}
          <div className="flex items-end pb-0.5">
            <PropertyIconButton
              label="Bo 4 góc độc lập"
              active={expandCorners}
              disabled={disabled}
              onClick={() => setExpandCorners((prev) => !prev)}
            >
              <Maximize size={12} />
            </PropertyIconButton>
          </div>
        </PropertyRow>

        {/* Expanded 4 Corners Inputs */}
        {expandCorners ? (
          <div className="rounded-[4px] bg-[var(--bg-hover,#262626)] p-2">
            <span className="mb-1 block text-[10px] text-[var(--fg-muted)]">
              Independent Corner Radii
            </span>
            <PropertyRow className="grid grid-cols-2 gap-1.5">
              <PropertyInput
                prefix="TL"
                type="number"
                min={0}
                value={corners.topLeft}
                onChange={(e) =>
                  onChangeCorners?.({ ...corners, topLeft: Number(e.target.value) })
                }
              />
              <PropertyInput
                prefix="TR"
                type="number"
                min={0}
                value={corners.topRight}
                onChange={(e) =>
                  onChangeCorners?.({ ...corners, topRight: Number(e.target.value) })
                }
              />
              <PropertyInput
                prefix="BL"
                type="number"
                min={0}
                value={corners.bottomLeft}
                onChange={(e) =>
                  onChangeCorners?.({ ...corners, bottomLeft: Number(e.target.value) })
                }
              />
              <PropertyInput
                prefix="BR"
                type="number"
                min={0}
                value={corners.bottomRight}
                onChange={(e) =>
                  onChangeCorners?.({ ...corners, bottomRight: Number(e.target.value) })
                }
              />
            </PropertyRow>
          </div>
        ) : null}
      </div>
    </PropertySection>
  );
}
