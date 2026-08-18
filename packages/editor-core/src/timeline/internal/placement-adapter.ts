import {
  createOverlayLaneAt,
  resolveAudioPlacementIntent,
  resolveVisualPlacement,
  type AudioPlacementIntent,
  type VisualPlacementIntent,
} from "../../operations/clip-move";
import {
  createAudioLane,
  shiftAudioLaneOrders,
  type TimelineClip,
  type TimelineLane,
} from "../timeline-clips";

export function applyVisualPlacement(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  intent: VisualPlacementIntent,
  movingClipId?: string,
): { lanes: TimelineLane[]; laneId: string; startTime: number } | null {
  const resolved = resolveVisualPlacement(lanes, clips, intent, movingClipId);
  if (resolved.status === "blocked") return null;
  if (resolved.status === "create-lane") {
    const created = createOverlayLaneAt(lanes, resolved.insertOrder);
    return {
      lanes: created.lanes,
      laneId: created.lane.id,
      startTime: resolved.startTime,
    };
  }
  return {
    lanes,
    laneId: resolved.laneId,
    startTime: resolved.startTime,
  };
}

export function applyAudioPlacement(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  intent: AudioPlacementIntent,
  movingClipId?: string,
): { lanes: TimelineLane[]; laneId: string; startTime: number } | null {
  const resolved = resolveAudioPlacementIntent(
    lanes,
    clips,
    intent,
    movingClipId,
  );
  if (resolved.status === "blocked") return null;
  if (resolved.status === "create-lane") {
    // Chỉ Library/paste — khi move, lane nguồn trông trống (clip bị loại).
    if (!movingClipId) {
      const reusable = lanes.find(
        (lane) =>
          lane.kind === "audio" &&
          lane.order === resolved.insertOrder &&
          !clips.some((clip) => clip.laneId === lane.id),
      );
      if (reusable) {
        return {
          lanes,
          laneId: reusable.id,
          startTime: resolved.startTime,
        };
      }
    }
    let nextLanes = shiftAudioLaneOrders(lanes, resolved.insertOrder, 1);
    const created = createAudioLane(resolved.insertOrder, undefined, nextLanes);
    nextLanes = [...nextLanes, created];
    return {
      lanes: nextLanes,
      laneId: created.id,
      startTime: resolved.startTime,
    };
  }
  return {
    lanes,
    laneId: resolved.laneId,
    startTime: resolved.startTime,
  };
}

/** Map flags → intent rồi applyVisualPlacement (paste/duplicate helpers). */
export function resolveOverlayPlacement(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  startTime: number,
  duration: number,
  preferredLaneId: string | null,
  insertNew: boolean,
  preferredInsertOrder?: number | null,
  movingClipId?: string,
): { lanes: TimelineLane[]; laneId: string; startTime: number } | null {
  const intent: VisualPlacementIntent =
    insertNew || !preferredLaneId
      ? {
          type: "new-overlay-lane",
          insertOrder: preferredInsertOrder ?? 0,
          startTime,
          duration,
        }
      : {
          type: "overlay-lane",
          laneId: preferredLaneId,
          startTime,
          duration,
        };
  return applyVisualPlacement(lanes, clips, intent, movingClipId);
}

export function resolveAudioPlacement(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  startTime: number,
  duration: number,
  preferredLaneId: string | null,
  insertNew: boolean,
  preferredInsertOrder?: number | null,
  movingClipId?: string,
): { lanes: TimelineLane[]; laneId: string; startTime: number } | null {
  if (insertNew) {
    return applyAudioPlacement(
      lanes,
      clips,
      {
        type: "new-audio-lane",
        insertOrder: preferredInsertOrder ?? 0,
        startTime,
        duration,
      },
      movingClipId,
    );
  }
  if (!preferredLaneId) {
    // Không có lane đích → tạo lane mới thay vì scan arbitrary.
    return applyAudioPlacement(
      lanes,
      clips,
      {
        type: "new-audio-lane",
        insertOrder: preferredInsertOrder ?? 0,
        startTime,
        duration,
      },
      movingClipId,
    );
  }
  return applyAudioPlacement(
    lanes,
    clips,
    {
      type: "audio-lane",
      laneId: preferredLaneId,
      startTime,
      duration,
    },
    movingClipId,
  );
}

export function audioLaneIdByOrder(
  lanes: TimelineLane[],
  order: number,
): string | undefined {
  return lanes.find((lane) => lane.kind === "audio" && lane.order === order)
    ?.id;
}
