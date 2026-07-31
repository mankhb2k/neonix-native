"use client";

import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Columns,
} from "lucide-react";
import { PropertySection, PropertyIconButton } from "@/components/ui";

export interface AlignmentSectionProps {
  onAlign?: (type: "left" | "h-center" | "right" | "top" | "v-center" | "bottom" | "distribute") => void;
  disabled?: boolean;
}

export function AlignmentSection({ onAlign, disabled = false }: AlignmentSectionProps) {
  return (
    <PropertySection title="Position / Alignment">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-[var(--fg-muted)]">Căn chỉnh Canvas</span>
        <div className="flex items-center justify-between rounded-[5px] bg-[var(--bg-hover,#262626)] p-1">
          <PropertyIconButton
            label="Căn trái"
            disabled={disabled}
            onClick={() => onAlign?.("left")}
          >
            <AlignLeft size={14} />
          </PropertyIconButton>
          <PropertyIconButton
            label="Căn giữa ngang"
            disabled={disabled}
            onClick={() => onAlign?.("h-center")}
          >
            <AlignCenter size={14} />
          </PropertyIconButton>
          <PropertyIconButton
            label="Căn phải"
            disabled={disabled}
            onClick={() => onAlign?.("right")}
          >
            <AlignRight size={14} />
          </PropertyIconButton>
          <div className="h-4 w-px bg-white/10" />
          <PropertyIconButton
            label="Căn trên"
            disabled={disabled}
            onClick={() => onAlign?.("top")}
          >
            <AlignStartVertical size={14} />
          </PropertyIconButton>
          <PropertyIconButton
            label="Căn giữa dọc"
            disabled={disabled}
            onClick={() => onAlign?.("v-center")}
          >
            <AlignCenterVertical size={14} />
          </PropertyIconButton>
          <PropertyIconButton
            label="Căn dưới"
            disabled={disabled}
            onClick={() => onAlign?.("bottom")}
          >
            <AlignEndVertical size={14} />
          </PropertyIconButton>
          <div className="h-4 w-px bg-white/10" />
          <PropertyIconButton
            label="Chia đều khoảng cách"
            disabled={disabled}
            onClick={() => onAlign?.("distribute")}
          >
            <Columns size={14} />
          </PropertyIconButton>
        </div>
      </div>
    </PropertySection>
  );
}
