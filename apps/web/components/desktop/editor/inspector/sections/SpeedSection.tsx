"use client";

import { Gauge, RotateCcw } from "lucide-react";
import {
  PropertySection,
  PropertyInput,
  PropertySelect,
  SliderPropertyInput,
} from "@/components/ui";

export interface SpeedSectionProps {
  speed?: number;
  curve?: string;
  smoothSlowMo?: boolean;
  reverse?: boolean;
  onChangeSpeed?: (speed: number) => void;
  onChangeCurve?: (curve: string) => void;
  onToggleSmoothSlowMo?: (enabled: boolean) => void;
  onToggleReverse?: (enabled: boolean) => void;
  disabled?: boolean;
}

export function SpeedSection({
  speed = 1,
  curve = "normal",
  smoothSlowMo = false,
  reverse = false,
  onChangeSpeed,
  onChangeCurve,
  onToggleSmoothSlowMo,
  onToggleReverse,
  disabled = false,
}: SpeedSectionProps) {
  return (
    <PropertySection title="Tốc độ clip">
      <div className="flex flex-col gap-3">
        {/* Speed Slider */}
        <SliderPropertyInput
          label="Tốc độ thường"
          min={0.1}
          max={10}
          step={0.1}
          value={speed}
          unit="x"
          disabled={disabled}
          onChange={(val) => onChangeSpeed?.(val)}
        />

        {/* Speed Curve Selection */}
        <PropertySelect
          label="Đường cong tốc độ (Speed Curve)"
          value={curve}
          disabled={disabled}
          onChange={(e) => onChangeCurve?.(e.target.value)}
        >
          <option value="normal">Bình thường (Normal)</option>
          <option value="hero">Anh hùng (Hero - Chậm rồi nhanh)</option>
          <option value="bullet">Bullet Time (Làm chậm giữa)</option>
          <option value="montage">Montage (Chuyển nhịp)</option>
          <option value="flash">Flash Out (Tăng tốc nhanh)</option>
        </PropertySelect>

        {/* Smooth Slow-mo toggle */}
        <label className="flex items-center justify-between rounded-[4px] bg-[var(--bg-hover,#262626)] p-2 cursor-pointer">
          <div className="flex items-center gap-2">
            <Gauge size={14} className="text-cyan-400" />
            <span className="text-ui font-medium text-[var(--fg)]">Làm chậm mượt (Optical Flow)</span>
          </div>
          <input
            type="checkbox"
            checked={smoothSlowMo}
            disabled={disabled}
            onChange={(e) => onToggleSmoothSlowMo?.(e.target.checked)}
            className="size-4 rounded border border-white/20 accent-[var(--accent,#3B82F6)] cursor-pointer"
          />
        </label>

        {/* Reverse Playback toggle */}
        <label className="flex items-center justify-between rounded-[4px] bg-[var(--bg-hover,#262626)] p-2 cursor-pointer">
          <div className="flex items-center gap-2">
            <RotateCcw size={14} className="text-purple-400" />
            <span className="text-ui font-medium text-[var(--fg)]">Phát ngược (Reverse)</span>
          </div>
          <input
            type="checkbox"
            checked={reverse}
            disabled={disabled}
            onChange={(e) => onToggleReverse?.(e.target.checked)}
            className="size-4 rounded border border-white/20 accent-[var(--accent,#3B82F6)] cursor-pointer"
          />
        </label>
      </div>
    </PropertySection>
  );
}
