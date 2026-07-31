"use client";

import { useState } from "react";
import { Crosshair, Lock, Unlock } from "lucide-react";
import {
  PropertySection,
  PropertyRow,
  PropertyInput,
  PropertyIconButton,
} from "@/components/ui";

export interface TransformSectionProps {
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  onChangePosition?: (pos: { x?: number; y?: number }) => void;
  onChangeScale?: (scale: { scaleX?: number; scaleY?: number }) => void;
  onChangeRotation?: (deg: number) => void;
  disabled?: boolean;
}

export function TransformSection({
  x = 0,
  y = 0,
  scaleX = 100,
  scaleY = 100,
  rotation = 0,
  onChangePosition,
  onChangeScale,
  onChangeRotation,
  disabled = false,
}: TransformSectionProps) {
  const [aspectLocked, setAspectLocked] = useState(true);
  const [keyframeState, setKeyframeState] = useState<Record<string, boolean>>({});

  const toggleKeyframe = (key: string) => {
    setKeyframeState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleScaleXChange = (newVal: number) => {
    if (aspectLocked) {
      onChangeScale?.({ scaleX: newVal, scaleY: newVal });
    } else {
      onChangeScale?.({ scaleX: newVal });
    }
  };

  const handleScaleYChange = (newVal: number) => {
    if (aspectLocked) {
      onChangeScale?.({ scaleX: newVal, scaleY: newVal });
    } else {
      onChangeScale?.({ scaleY: newVal });
    }
  };

  return (
    <PropertySection
      title="Transform"
      action={
        <PropertyIconButton label="Scope điểm tâm">
          <Crosshair size={14} />
        </PropertyIconButton>
      }
    >
      <div className="flex flex-col gap-2">
        {/* Position Row */}
        <div>
          <span className="mb-1 block text-caption text-[var(--fg-muted)]">Position</span>
          <PropertyRow>
            <PropertyInput
              id="transform-x"
              prefix="X →"
              type="number"
              step={1}
              stepper
              disabled={disabled}
              value={x}
              keyframeable
              isKeyframed={keyframeState.x}
              onToggleKeyframe={() => toggleKeyframe("x")}
              onChange={(e) => onChangePosition?.({ x: Number(e.target.value) })}
            />
            <PropertyInput
              id="transform-y"
              prefix="Y ↓"
              type="number"
              step={1}
              stepper
              disabled={disabled}
              value={y}
              keyframeable
              isKeyframed={keyframeState.y}
              onToggleKeyframe={() => toggleKeyframe("y")}
              onChange={(e) => onChangePosition?.({ y: Number(e.target.value) })}
            />
          </PropertyRow>
        </div>

        {/* Scale Row */}
        <div>
          <span className="mb-1 block text-caption text-[var(--fg-muted)]">Scale</span>
          <PropertyRow>
            <PropertyInput
              id="transform-scale-x"
              prefix="↔"
              suffix="%"
              type="number"
              step={1}
              stepper
              disabled={disabled}
              value={scaleX}
              keyframeable
              isKeyframed={keyframeState.scaleX}
              onToggleKeyframe={() => toggleKeyframe("scaleX")}
              onChange={(e) => handleScaleXChange(Number(e.target.value))}
            />
            <PropertyInput
              id="transform-scale-y"
              prefix="↕"
              suffix="%"
              type="number"
              step={1}
              stepper
              disabled={disabled}
              value={scaleY}
              keyframeable
              isKeyframed={keyframeState.scaleY}
              onToggleKeyframe={() => toggleKeyframe("scaleY")}
              onChange={(e) => handleScaleYChange(Number(e.target.value))}
            />
            <PropertyIconButton
              label="Khóa tỷ lệ (Aspect Ratio)"
              active={aspectLocked}
              disabled={disabled}
              onClick={() => setAspectLocked((prev) => !prev)}
            >
              {aspectLocked ? <Lock size={12} /> : <Unlock size={12} />}
            </PropertyIconButton>
          </PropertyRow>
        </div>

        {/* Rotation Row */}
        <div className="w-1/2 pr-1">
          <span className="mb-1 block text-caption text-[var(--fg-muted)]">Rotation</span>
          <PropertyInput
            id="transform-rotation"
            prefix="↰"
            suffix="°"
            type="number"
            step={1}
            stepper
            disabled={disabled}
            value={rotation}
            keyframeable
            isKeyframed={keyframeState.rotation}
            onToggleKeyframe={() => toggleKeyframe("rotation")}
            onChange={(e) => onChangeRotation?.(Number(e.target.value))}
          />
        </div>
      </div>
    </PropertySection>
  );
}
