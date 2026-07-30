import type { TimelineLane } from "@/lib/editor/timeline-clips";

export const MAIN_LANE_HEIGHT_PX = 60;
export const SECONDARY_LANE_HEIGHT_PX = 48;
export const LAYER_LANE_HEIGHT_PX = 24;
export const LANE_GAP_PX = 2;
export const TIMELINE_TOP_PADDING_PX = 40;
export const TIMELINE_BOTTOM_PADDING_PX = 40;

export type TimelineLaneRow = {
  id: string;
  kind: "visual" | "audio";
  role: "base" | "overlay" | "audio";
  order: number;
  name?: string;
  height: number;
  heightClass: string;
  lane: TimelineLane;
};

export function buildTimelineLaneRows(
  timelineLanes: ReadonlyArray<TimelineLane>,
): TimelineLaneRow[] {
  const mainLane = timelineLanes.find(
    (l) => l.kind === "visual" && l.role === "base",
  );
  const overlayLanes = timelineLanes
    .filter((l) => l.kind === "visual" && l.role === "overlay")
    .sort((a, b) => b.order - a.order);
  const audioLanes = timelineLanes
    .filter((l) => l.kind === "audio")
    .sort((a, b) => a.order - b.order);

  const rows: TimelineLaneRow[] = [];

  for (const lane of overlayLanes) {
    rows.push({
      id: lane.id,
      kind: "visual",
      role: "overlay",
      order: lane.order,
      name: lane.name,
      height: SECONDARY_LANE_HEIGHT_PX,
      heightClass: "h-12",
      lane,
    });
  }

  if (mainLane) {
    rows.push({
      id: mainLane.id,
      kind: "visual",
      role: "base",
      order: mainLane.order,
      name: mainLane.name,
      height: MAIN_LANE_HEIGHT_PX,
      heightClass: "h-15",
      lane: mainLane,
    });
  }

  for (const lane of audioLanes) {
    rows.push({
      id: lane.id,
      kind: "audio",
      role: "audio",
      order: lane.order,
      name: lane.name,
      height: SECONDARY_LANE_HEIGHT_PX,
      heightClass: "h-12",
      lane,
    });
  }

  return rows;
}
