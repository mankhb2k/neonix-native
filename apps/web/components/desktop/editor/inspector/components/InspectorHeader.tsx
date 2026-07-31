"use client";

import { ChevronDown, Component, Crosshair, Layers, Sliders } from "lucide-react";
import { PropertyIconButton } from "@/components/ui";

export interface InspectorHeaderProps {
  nodeType?: string;
  nodeName?: string;
  onTargetScopeToggle?: () => void;
}

export function InspectorHeader({
  nodeType = "Group",
  nodeName = "Layer",
  onTargetScopeToggle,
}: InspectorHeaderProps) {
  return (
    <div className="flex h-9 items-center justify-between border-b border-[var(--line,#262626)] px-3 py-1.5 bg-[var(--bg-card,#171717)]">
      {/* Node selection breadcrumb */}
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-[4px] px-1.5 py-0.5 text-ui font-medium text-[var(--fg,#FFF)] hover:bg-[var(--bg-hover,#262626)]"
      >
        <Layers size={13} className="text-[var(--fg-muted)]" />
        <span className="capitalize">{nodeName || nodeType}</span>
        <ChevronDown size={11} className="text-[var(--fg-muted)]" />
      </button>

      {/* Target scope & style actions */}
      <div className="flex items-center gap-0.5">
        <PropertyIconButton label="Chỉnh Style Component">
          <Component size={13} />
        </PropertyIconButton>
        <PropertyIconButton label="Chỉnh Biến số Style">
          <Sliders size={13} />
        </PropertyIconButton>
        <PropertyIconButton label="Định vị điểm tâm Target" onClick={onTargetScopeToggle}>
          <Crosshair size={13} />
        </PropertyIconButton>
      </div>
    </div>
  );
}
