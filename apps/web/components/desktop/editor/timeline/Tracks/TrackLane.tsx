"use client";

import React from "react";

export type TrackVariant = "main" | "secondary" | "layer";

type TrackLaneProps = {
  /** Track variant: "main" (Frame chính), "secondary" (Frame phụ & Audio), "layer" (Dành riêng cho Layer trong Frame) */
  variant?: TrackVariant;
  /** 1. Chiều cao riêng cho Frame chính (Default: "h-12") */
  mainTrackHeight?: string;
  /** 2. Chiều cao riêng cho Frame phụ & Audio (Default: "h-7") */
  secondaryTrackHeight?: string;
  /** 3. Chiều cao riêng dành cho các Layer trong Frame (Default: "h-6") */
  layerTrackHeight?: string;
  /** Prop thiết kế sẵn dành riêng chứa thông tin các Layer trong Frame (Dành cho sử dụng tương lai) */
  frameLayers?: any[];
  /** Override tùy chỉnh trực tiếp height class */
  heightClass?: string;
  bgClass?: string;
  borderClass?: string;
  labelWidth: number;
  canvasWidth: number;
  leftControl: React.ReactNode;
  children: React.ReactNode;
};

export function TrackLane({
  variant = "main",
  mainTrackHeight = "h-15",
  secondaryTrackHeight = "h-12",
  layerTrackHeight = "h-6",
  frameLayers = [],
  heightClass,
  bgClass = "bg-[#121214]/80",
  borderClass = "border-y border-[#27272A]/50",
  labelWidth,
  canvasWidth,
  leftControl,
  children,
}: TrackLaneProps) {
  // Tự động chọn class chiều cao dựa trên variant và 3 props chiều cao riêng biệt
  const resolvedHeightClass =
    heightClass ??
    (variant === "main"
      ? mainTrackHeight
      : variant === "secondary"
        ? secondaryTrackHeight
        : layerTrackHeight);

  return (
    <div
      className={`group relative flex items-center ${resolvedHeightClass} ${bgClass} ${borderClass} transition-colors`}
    >
      {/* Sticky Left Control Sidebar */}
      <div
        className="sticky left-0 z-20 flex h-full shrink-0 items-center justify-center gap-1 bg-[var(--bg-panel)] border-r border-[var(--border-subtle)] px-2"
        style={{ width: labelWidth }}
      >
        {leftControl}
      </div>

      {/* Runway Canvas Strip with vertical padding & centered content */}
      <div
        className="relative h-full flex-1 flex items-center py-[1px]"
        style={{ width: canvasWidth }}
      >
        {children}
      </div>
    </div>
  );
}
