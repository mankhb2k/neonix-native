"use client";

import { memo, type ReactNode } from "react";
import {
  TrackLane,
  type GhostPreviewInfo,
  type TrackVariant,
} from "../Tracks/TrackLane";

export type TimelineLaneViewProps = {
  laneId: string | null | undefined;
  order?: number;
  trackType: "main" | "overlay" | "audio";
  variant?: TrackVariant;
  ghostPreview?: GhostPreviewInfo | null;
  labelWidth: number;
  canvasWidth: number;
  children: ReactNode;
};

function TimelineLaneViewInner({
  laneId,
  order,
  trackType,
  variant = trackType === "main" ? "main" : "secondary",
  ghostPreview,
  labelWidth,
  canvasWidth,
  children,
}: TimelineLaneViewProps) {
  return (
    <TrackLane
      variant={variant}
      dataTrackType={trackType}
      dataLaneId={laneId}
      dataLaneOrder={order}
      ghostPreview={ghostPreview}
      labelWidth={labelWidth}
      canvasWidth={canvasWidth}
    >
      {children}
    </TrackLane>
  );
}

export const TimelineLaneView = memo(TimelineLaneViewInner);
