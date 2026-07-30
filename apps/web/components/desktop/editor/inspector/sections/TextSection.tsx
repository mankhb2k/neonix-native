"use client";

import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from "lucide-react";
import {
  PropertySection,
  PropertyRow,
  PropertyInput,
  PropertySelect,
  SegmentedControl,
} from "@/components/ui";

export interface TextSectionProps {
  text?: string;
  fontFamily?: string;
  fontWeight?: string;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  align?: "left" | "center" | "right" | "justify";
  onChangeText?: (text: string) => void;
  onChangeFont?: (font: { family?: string; weight?: string; size?: number }) => void;
  onChangeSpacing?: (spacing: { lineHeight?: number; letterSpacing?: number }) => void;
  onChangeAlign?: (align: "left" | "center" | "right" | "justify") => void;
  disabled?: boolean;
}

export function TextSection({
  text = "",
  fontFamily = "Inter",
  fontWeight = "400",
  fontSize = 16,
  lineHeight = 1.2,
  letterSpacing = 0,
  align = "left",
  onChangeText,
  onChangeFont,
  onChangeSpacing,
  onChangeAlign,
  disabled = false,
}: TextSectionProps) {
  const alignOptions = [
    { value: "left", icon: <AlignLeft size={13} />, tooltip: "Căn trái" },
    { value: "center", icon: <AlignCenter size={13} />, tooltip: "Căn giữa" },
    { value: "right", icon: <AlignRight size={13} />, tooltip: "Căn phải" },
    { value: "justify", icon: <AlignJustify size={13} />, tooltip: "Căn đều" },
  ];

  return (
    <PropertySection title="Typography (Chữ)">
      <div className="flex flex-col gap-2">
        {/* Content Textarea */}
        <textarea
          value={text}
          disabled={disabled}
          placeholder="Nhập nội dung chữ..."
          onChange={(e) => onChangeText?.(e.target.value)}
          className="h-16 w-full rounded-[4px] bg-[var(--bg-hover,#262626)] p-2 text-ui font-regular leading-snug text-[var(--fg,#FFF)] outline-none resize-none disabled:opacity-40"
        />

        {/* Font Family & Weight */}
        <PropertyRow>
          <PropertySelect
            label="Font"
            value={fontFamily}
            disabled={disabled}
            onChange={(e) => onChangeFont?.({ family: e.target.value })}
          >
            <option value="Inter">Inter</option>
            <option value="Roboto">Roboto</option>
            <option value="Outfit">Outfit</option>
            <option value="Montserrat">Montserrat</option>
            <option value="Playfair Display">Playfair Display</option>
          </PropertySelect>

          <PropertySelect
            label="Weight"
            value={fontWeight}
            disabled={disabled}
            onChange={(e) => onChangeFont?.({ weight: e.target.value })}
          >
            <option value="300">Light (300)</option>
            <option value="400">Regular (400)</option>
            <option value="500">Medium (500)</option>
            <option value="600">SemiBold (600)</option>
            <option value="700">Bold (700)</option>
          </PropertySelect>
        </PropertyRow>

        {/* Font Size, Line Height, Letter Spacing */}
        <PropertyRow>
          <PropertyInput
            label="Cỡ chữ"
            suffix="px"
            type="number"
            min={1}
            step={1}
            stepper
            disabled={disabled}
            value={fontSize}
            onChange={(e) => onChangeFont?.({ size: Number(e.target.value) })}
          />
          <PropertyInput
            label="Dòng"
            prefix="↕"
            type="number"
            min={0.5}
            step={0.1}
            stepper
            disabled={disabled}
            value={lineHeight}
            onChange={(e) => onChangeSpacing?.({ lineHeight: Number(e.target.value) })}
          />
          <PropertyInput
            label="Ký tự"
            prefix="↔"
            type="number"
            step={0.5}
            stepper
            disabled={disabled}
            value={letterSpacing}
            onChange={(e) => onChangeSpacing?.({ letterSpacing: Number(e.target.value) })}
          />
        </PropertyRow>

        {/* Alignment */}
        <div>
          <span className="mb-1 block text-caption text-[var(--fg-muted)]">Căn chữ</span>
          <SegmentedControl
            options={alignOptions}
            value={align}
            onChange={(val) => onChangeAlign?.(val as typeof align)}
          />
        </div>
      </div>
    </PropertySection>
  );
}
