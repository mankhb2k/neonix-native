import {
  BASE_LANE_HEIGHT_PX,
  LAYER_LANE_HEIGHT_PX,
  LAYER_VIDEO_LANE_HEIGHT_PX,
  SECONDARY_LANE_HEIGHT_PX,
} from "../timeline-scale";
import type { DesignLaneRole } from "./track-kind";

export type DesignLane = {
  id: string;
  name: string;
  role: DesignLaneRole;
  kind: "visual" | "audio";
};

export type DesignLaneRow = DesignLane & {
  height: number;
};

/** Track mode: overlays (desc by name order) → main → audio. */
export function buildTrackLaneRows(lanes: DesignLane[]): DesignLaneRow[] {
  const overlays = lanes
    .filter((l) => l.role === "overlay")
    .map((l) => ({ ...l, height: SECONDARY_LANE_HEIGHT_PX }));
  const base = lanes
    .filter((l) => l.role === "base")
    .map((l) => ({ ...l, height: BASE_LANE_HEIGHT_PX }));
  const audio = lanes
    .filter((l) => l.role === "audio")
    .map((l) => ({ ...l, height: SECONDARY_LANE_HEIGHT_PX }));
  return [...overlays, ...base, ...audio];
}

/** Layer mode: compact rows (first = video-ish). */
export function buildLayerLaneRows(lanes: DesignLane[]): DesignLaneRow[] {
  return lanes.map((l, i) => ({
    ...l,
    height: i === 0 ? LAYER_VIDEO_LANE_HEIGHT_PX : LAYER_LANE_HEIGHT_PX,
  }));
}
