"use client";

import { useState } from "react";
import {
  LayoutGrid,
  Maximize2,
  ArrowDownUp,
  ArrowLeftRight,
  Grid,
} from "lucide-react";
import {
  PropertySection,
  PropertyRow,
  PropertyInput,
  PropertyIconButton,
  SegmentedControl,
} from "@/components/ui";

export interface LayoutSectionProps {
  flow?: "absolute" | "flex-col" | "flex-row" | "grid";
  width?: number;
  height?: number;
  onChangeFlow?: (flow: "absolute" | "flex-col" | "flex-row" | "grid") => void;
  onChangeDimensions?: (dim: { width?: number; height?: number }) => void;
  disabled?: boolean;
}

export function LayoutSection({
  flow = "absolute",
  width = 100,
  height = 100,
  onChangeFlow,
  onChangeDimensions,
  disabled = false,
}: LayoutSectionProps) {
  const [dimLocked, setDimLocked] = useState(false);

  const flowOptions = [
    {
      value: "absolute",
      icon: <LayoutGrid size={13} />,
      tooltip: "Freeform / Absolute Flow",
    },
    {
      value: "flex-col",
      icon: <ArrowDownUp size={13} />,
      tooltip: "Flex Column (Cột)",
    },
    {
      value: "flex-row",
      icon: <ArrowLeftRight size={13} />,
      tooltip: "Flex Row (Hàng)",
    },
    {
      value: "grid",
      icon: <Grid size={13} />,
      tooltip: "Auto Grid Layout",
    },
  ];

  return (
    <PropertySection
      title="Layout"
      action={
        <PropertyIconButton label="Thiết lập Auto Layout">
          <Maximize2 size={13} />
        </PropertyIconButton>
      }
    >
      <div className="flex flex-col gap-2">
        {/* Flow segmented control */}
        <div>
          <span className="mb-1 block text-caption text-[var(--fg-muted)]">Flow</span>
          <SegmentedControl
            options={flowOptions}
            value={flow}
            onChange={(val) => onChangeFlow?.(val as typeof flow)}
          />
        </div>

        {/* Dimensions W & H */}
        <div>
          <span className="mb-1 block text-caption text-[var(--fg-muted)]">Dimensions</span>
          <PropertyRow>
            <PropertyInput
              id="layout-w"
              prefix="W"
              type="number"
              step={1}
              stepper
              disabled={disabled}
              value={width}
              onChange={(e) => onChangeDimensions?.({ width: Number(e.target.value) })}
            />
            <PropertyInput
              id="layout-h"
              prefix="H"
              type="number"
              step={1}
              stepper
              disabled={disabled}
              value={height}
              onChange={(e) => onChangeDimensions?.({ height: Number(e.target.value) })}
            />
            <PropertyIconButton
              label="Khóa tỷ lệ khung hình"
              active={dimLocked}
              disabled={disabled}
              onClick={() => setDimLocked((prev) => !prev)}
            >
              <Maximize2 size={12} />
            </PropertyIconButton>
          </PropertyRow>
        </div>
      </div>
    </PropertySection>
  );
}
