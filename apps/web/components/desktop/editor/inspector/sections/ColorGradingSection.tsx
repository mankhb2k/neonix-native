"use client";

import { Sun, SlidersHorizontal } from "lucide-react";
import {
  PropertySection,
  PropertySelect,
  SliderPropertyInput,
} from "@/components/ui";

export interface ColorGradingSectionProps {
  temperature?: number;
  tint?: number;
  saturation?: number;
  contrast?: number;
  brightness?: number;
  vignette?: number;
  lutFilter?: string;
  onChangeGrading?: (params: {
    temperature?: number;
    tint?: number;
    saturation?: number;
    contrast?: number;
    brightness?: number;
    vignette?: number;
    lutFilter?: string;
  }) => void;
  disabled?: boolean;
}

export function ColorGradingSection({
  temperature = 0,
  tint = 0,
  saturation = 100,
  contrast = 100,
  brightness = 0,
  vignette = 0,
  lutFilter = "none",
  onChangeGrading,
  disabled = false,
}: ColorGradingSectionProps) {
  return (
    <PropertySection title="Điều chỉnh màu sắc (Adjust)">
      <div className="flex flex-col gap-3">
        {/* LUT Color Filter Preset */}
        <PropertySelect
          label="Bộ lọc màu (LUT Presets)"
          value={lutFilter}
          disabled={disabled}
          onChange={(e) => onChangeGrading?.({ lutFilter: e.target.value })}
        >
          <option value="none">Mặc định (Original)</option>
          <option value="cinematic">Cinematic Film</option>
          <option value="cyberpunk">Cyberpunk Neon</option>
          <option value="vintage">Vintage Retro</option>
          <option value="warm">Warm Summer</option>
          <option value="cool">Cool Winter</option>
        </PropertySelect>

        {/* Temperature & Tint */}
        <SliderPropertyInput
          label="Nhiệt độ màu (Temperature)"
          min={-100}
          max={100}
          value={temperature}
          unit=""
          disabled={disabled}
          onChange={(val) => onChangeGrading?.({ temperature: val })}
        />

        <SliderPropertyInput
          label="Tông màu (Tint)"
          min={-100}
          max={100}
          value={tint}
          unit=""
          disabled={disabled}
          onChange={(val) => onChangeGrading?.({ tint: val })}
        />

        {/* Saturation */}
        <SliderPropertyInput
          label="Độ bão hòa (Saturation)"
          min={0}
          max={200}
          value={saturation}
          unit="%"
          disabled={disabled}
          onChange={(val) => onChangeGrading?.({ saturation: val })}
        />

        {/* Contrast */}
        <SliderPropertyInput
          label="Độ tương phản (Contrast)"
          min={0}
          max={200}
          value={contrast}
          unit="%"
          disabled={disabled}
          onChange={(val) => onChangeGrading?.({ contrast: val })}
        />

        {/* Brightness */}
        <SliderPropertyInput
          label="Độ sáng (Brightness)"
          min={-100}
          max={100}
          value={brightness}
          unit=""
          disabled={disabled}
          onChange={(val) => onChangeGrading?.({ brightness: val })}
        />

        {/* Vignette */}
        <SliderPropertyInput
          label="Tối góc (Vignette)"
          min={0}
          max={100}
          value={vignette}
          unit="%"
          disabled={disabled}
          onChange={(val) => onChangeGrading?.({ vignette: val })}
        />
      </div>
    </PropertySection>
  );
}
