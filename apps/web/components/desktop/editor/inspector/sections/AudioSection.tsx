"use client";

import { Volume2, Sparkles } from "lucide-react";
import {
  PropertySection,
  PropertyRow,
  PropertyInput,
  PropertySelect,
  SliderPropertyInput,
} from "@/components/ui";

export interface AudioSectionProps {
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
  noiseReduction?: boolean;
  voiceEffect?: string;
  onChangeVolume?: (vol: number) => void;
  onChangeFade?: (fade: { fadeIn?: number; fadeOut?: number }) => void;
  onToggleNoiseReduction?: (enabled: boolean) => void;
  onChangeVoiceEffect?: (effect: string) => void;
  disabled?: boolean;
}

export function AudioSection({
  volume = 100,
  fadeIn = 0,
  fadeOut = 0,
  noiseReduction = false,
  voiceEffect = "none",
  onChangeVolume,
  onChangeFade,
  onToggleNoiseReduction,
  onChangeVoiceEffect,
  disabled = false,
}: AudioSectionProps) {
  return (
    <PropertySection title="Âm thanh">
      <div className="flex flex-col gap-3">
        {/* Volume Slider */}
        <SliderPropertyInput
          label="Âm lượng"
          min={0}
          max={200}
          value={volume}
          unit="%"
          disabled={disabled}
          keyframeable
          onChange={(val) => onChangeVolume?.(val)}
        />

        {/* Fade In & Fade Out */}
        <PropertyRow>
          <PropertyInput
            label="Fade In"
            prefix="s"
            type="number"
            min={0}
            step={0.1}
            stepper
            disabled={disabled}
            value={fadeIn}
            onChange={(e) => onChangeFade?.({ fadeIn: Number(e.target.value) })}
          />
          <PropertyInput
            label="Fade Out"
            prefix="s"
            type="number"
            min={0}
            step={0.1}
            stepper
            disabled={disabled}
            value={fadeOut}
            onChange={(e) => onChangeFade?.({ fadeOut: Number(e.target.value) })}
          />
        </PropertyRow>

        {/* Voice Effect */}
        <PropertySelect
          label="Hiệu ứng giọng nói"
          value={voiceEffect}
          disabled={disabled}
          onChange={(e) => onChangeVoiceEffect?.(e.target.value)}
        >
          <option value="none">Mặc định (None)</option>
          <option value="deep">Giọng trầm (Deep)</option>
          <option value="high">Giọng cao (High Pitch)</option>
          <option value="robot">Người máy (Robot)</option>
          <option value="echo">Vang vọng (Echo)</option>
          <option value="reverb">Phòng lớn (Reverb)</option>
        </PropertySelect>

        {/* Noise Reduction AI Toggle */}
        <label className="flex items-center justify-between rounded-[4px] bg-[var(--bg-hover,#262626)] p-2 cursor-pointer">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-amber-400" />
            <span className="text-ui font-medium text-[var(--fg)]">Lọc tạp âm AI (Noise Reduction)</span>
          </div>
          <input
            type="checkbox"
            checked={noiseReduction}
            disabled={disabled}
            onChange={(e) => onToggleNoiseReduction?.(e.target.checked)}
            className="size-4 rounded border border-white/20 accent-[var(--accent,#3B82F6)] cursor-pointer"
          />
        </label>
      </div>
    </PropertySection>
  );
}
