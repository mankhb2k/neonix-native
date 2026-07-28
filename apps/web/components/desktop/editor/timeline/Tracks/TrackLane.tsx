"use client";

import React, { useLayoutEffect, useRef } from "react";
import { bindDragGhostElement, unbindDragGhostElementIf } from "@/lib/editor-drag-cursor";

export type TrackVariant = "main" | "secondary" | "layer";

export type GhostPreviewInfo = {
  left: number;
  width: number;
  label?: string;
  duration?: number;
};

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
  /** Khối Ghost Preview hiển thị vị trí thả khi đang Drag */
  ghostPreview?: GhostPreviewInfo | null;
  dataTrackType?: "main" | "overlay";
  dataLayerIndex?: number;
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
  bgClass = "bg-[var(--timeline-track-lane)]",
  borderClass = "",
  ghostPreview,
  dataTrackType,
  dataLayerIndex,
  labelWidth,
  canvasWidth,
  leftControl,
  children,
}: TrackLaneProps) {
  const ghostRef = useRef<HTMLDivElement>(null);

  // Tự động chọn class chiều cao dựa trên variant và 3 props chiều cao riêng biệt
  const resolvedHeightClass =
    heightClass ??
    (variant === "main"
      ? mainTrackHeight
      : variant === "secondary"
        ? secondaryTrackHeight
        : layerTrackHeight);

  const showGhost = Boolean(ghostPreview);

  useLayoutEffect(() => {
    if (!showGhost) {
      unbindDragGhostElementIf(ghostRef.current);
      return;
    }
    bindDragGhostElement(ghostRef.current);
    return () => {
      unbindDragGhostElementIf(ghostRef.current);
    };
  }, [showGhost]);

  return (
    <div
      data-track-lane="true"
      data-track-type={dataTrackType}
      data-layer-index={dataLayerIndex}
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

        {/* Gray drop ghost — left/width driven imperatively (synced with cyan rAF) */}
        {ghostPreview && (
          <div
            ref={ghostRef}
            className="absolute top-0 bottom-0 my-auto h-[90%] pointer-events-none rounded bg-[#38383e] border border-[#4a4a52] shadow-md z-20 overflow-hidden will-change-[left]"
            style={{ width: ghostPreview.width }}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
