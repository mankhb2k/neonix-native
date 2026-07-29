"use client";

import React, { useLayoutEffect, useRef } from "react";
import { bindDragGhostElement, unbindDragGhostElementIf } from "@/lib/editor/drag-cursor";

export type TrackVariant = "main" | "secondary" | "layer";

export type GhostPreviewInfo = {
  left: number;
  width: number;
  label?: string;
  duration?: number;
};

type TrackLaneProps = {
  variant?: TrackVariant;
  mainTrackHeight?: string;
  secondaryTrackHeight?: string;
  layerTrackHeight?: string;
  heightClass?: string;
  bgClass?: string;
  borderClass?: string;
  ghostPreview?: GhostPreviewInfo | null;
  dataTrackType?: "main" | "overlay" | "audio";
  dataLaneId?: string;
  dataLaneOrder?: number;
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
  heightClass,
  bgClass = "bg-[var(--timeline-track-lane)]",
  borderClass = "",
  ghostPreview,
  dataTrackType,
  dataLaneId,
  dataLaneOrder,
  labelWidth,
  canvasWidth,
  leftControl,
  children,
}: TrackLaneProps) {
  const ghostRef = useRef<HTMLDivElement>(null);

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
      data-lane-id={dataLaneId}
      data-lane-order={dataLaneOrder}
      className={`group relative flex items-center ${resolvedHeightClass} ${bgClass} ${borderClass} transition-colors`}
    >
      <div
        className="sticky left-0 z-20 flex h-full shrink-0 items-center justify-center gap-1 bg-[var(--bg-panel)] border-r border-[var(--border-subtle)] px-2"
        style={{ width: labelWidth }}
        data-marquee-ignore="true"
      >
        {leftControl}
      </div>

      <div
        className="relative h-full flex-1 flex items-center py-[1px]"
        style={{ width: canvasWidth }}
      >
        {children}

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
