import type { MotionProject } from "@motionvideo/motion-schema";
import type { TimelineClip, TimelineLane } from "@/lib/editor/model/timeline-types";

/**
 * TimelineDocument — domain aggregate gom project, lanes, clips.
 * Mọi committed mutation phải nhận/trả về TimelineDocument hợp lệ.
 */
export type TimelineDocument = {
  project: MotionProject;
  lanes: TimelineLane[];
  clips: TimelineClip[];
};

export type TimelineViolationReason =
  | "missing_base_lane"
  | "multiple_base_lanes"
  | "invalid_base_lane_order"
  | "duplicate_lane_id"
  | "duplicate_clip_id"
  | "invalid_lane_orders"
  | "dangling_clip_lane_id"
  | "dangling_scene_reference"
  | "dangling_audio_track_reference"
  | "clip_overlap_violation";

export type TimelineViolation = {
  reason: TimelineViolationReason;
  message: string;
  details?: Record<string, unknown>;
};

export type TimelineValidationResult =
  | { valid: true }
  | { valid: false; violations: TimelineViolation[] };

/** Build a TimelineDocument from store state shape. */
export function documentFromStoreState(state: {
  project: MotionProject | null;
  timelineLanes: TimelineLane[];
  timelineClips: TimelineClip[];
}): TimelineDocument | null {
  if (!state.project) return null;
  return {
    project: state.project,
    lanes: state.timelineLanes,
    clips: state.timelineClips,
  };
}

/** Extract store state slice from a TimelineDocument. */
export function storeStateFromDocument(doc: TimelineDocument): {
  project: MotionProject;
  timelineLanes: TimelineLane[];
  timelineClips: TimelineClip[];
} {
  return {
    project: doc.project,
    timelineLanes: doc.lanes,
    timelineClips: doc.clips,
  };
}

/** Helper so sánh overlap thời gian giữa 2 clip */
function clipsOverlap(
  aStart: number,
  aDur: number,
  bStart: number,
  bDur: number,
): boolean {
  return aStart < bStart + bDur && bStart < aStart + aDur;
}

/**
 * Validate TimelineDocument against all core invariants.
 * Returns structured list of violations if invalid.
 */
export function validateTimelineDocument(
  doc: TimelineDocument,
): TimelineValidationResult {
  const violations: TimelineViolation[] = [];

  // 1. Kiểm tra Base Lane
  const baseLanes = doc.lanes.filter(
    (l) => l.kind === "visual" && l.role === "base",
  );
  if (baseLanes.length === 0) {
    violations.push({
      reason: "missing_base_lane",
      message: "TimelineDocument phải có ít nhất 1 visual base lane.",
    });
  } else if (baseLanes.length > 1) {
    violations.push({
      reason: "multiple_base_lanes",
      message: `Tìm thấy ${baseLanes.length} base lanes. Chỉ cho phép đúng 1 base lane.`,
      details: { ids: baseLanes.map((l) => l.id) },
    });
  } else if (baseLanes[0].order !== -1) {
    violations.push({
      reason: "invalid_base_lane_order",
      message: `Base lane order phải luôn bằng -1 (hiện tại: ${baseLanes[0].order}).`,
      details: { laneId: baseLanes[0].id, order: baseLanes[0].order },
    });
  }

  // 2. ID duy nhất cho Lanes
  const laneIds = new Set<string>();
  for (const lane of doc.lanes) {
    if (laneIds.has(lane.id)) {
      violations.push({
        reason: "duplicate_lane_id",
        message: `Trùng lặp lane id "${lane.id}".`,
        details: { laneId: lane.id },
      });
    }
    laneIds.add(lane.id);
  }

  // 3. ID duy nhất cho Clips
  const clipIds = new Set<string>();
  for (const clip of doc.clips) {
    if (clipIds.has(clip.id)) {
      violations.push({
        reason: "duplicate_clip_id",
        message: `Trùng lặp clip id "${clip.id}".`,
        details: { clipId: clip.id },
      });
    }
    clipIds.add(clip.id);
  }

  // 4. Thứ tự các Overlay và Audio Lanes (0..N-1)
  const overlayLanes = doc.lanes
    .filter((l) => l.kind === "visual" && l.role === "overlay")
    .sort((a, b) => a.order - b.order);
  overlayLanes.forEach((lane, idx) => {
    if (lane.order !== idx) {
      violations.push({
        reason: "invalid_lane_orders",
        message: `Overlay lane "${lane.name}" (id: ${lane.id}) có order ${lane.order}, mong đợi ${idx}.`,
        details: { laneId: lane.id, actual: lane.order, expected: idx },
      });
    }
  });

  const audioLanes = doc.lanes
    .filter((l) => l.kind === "audio")
    .sort((a, b) => a.order - b.order);
  audioLanes.forEach((lane, idx) => {
    if (lane.order !== idx) {
      violations.push({
        reason: "invalid_lane_orders",
        message: `Audio lane "${lane.name}" (id: ${lane.id}) có order ${lane.order}, mong đợi ${idx}.`,
        details: { laneId: lane.id, actual: lane.order, expected: idx },
      });
    }
  });

  // 5. Dangling clip laneId reference
  for (const clip of doc.clips) {
    if (clip.laneId && !laneIds.has(clip.laneId)) {
      violations.push({
        reason: "dangling_clip_lane_id",
        message: `Clip "${clip.name}" (id: ${clip.id}) tham chiếu laneId không tồn tại "${clip.laneId}".`,
        details: { clipId: clip.id, laneId: clip.laneId },
      });
    }
  }

  // 6. Project schema reference integrity
  const projectSceneIds = new Set(doc.project.scenes.map((s) => s.id));
  const audioTrackIds = new Set(
    (doc.project.timeline.audioTracks ?? []).map((t) => t.id),
  );

  for (const clip of doc.clips) {
    if (clip.kind === "scene") {
      if (!projectSceneIds.has(clip.sceneId)) {
        violations.push({
          reason: "dangling_scene_reference",
          message: `Scene clip "${clip.name}" (id: ${clip.id}) tham chiếu sceneId "${clip.sceneId}" không có trong project.scenes.`,
          details: { clipId: clip.id, sceneId: clip.sceneId },
        });
      }
    } else if (clip.kind === "audio") {
      if (clip.audioTrackId && !audioTrackIds.has(clip.audioTrackId)) {
        violations.push({
          reason: "dangling_audio_track_reference",
          message: `Audio clip "${clip.name}" (id: ${clip.id}) tham chiếu audioTrackId "${clip.audioTrackId}" không có trong project.timeline.audioTracks.`,
          details: { clipId: clip.id, audioTrackId: clip.audioTrackId },
        });
      }
    }
  }

  // 7. No overlapping clips on non-overlapping lanes
  const clipsByLane = new Map<string, TimelineClip[]>();
  for (const clip of doc.clips) {
    if (!clip.laneId) continue;
    const list = clipsByLane.get(clip.laneId) ?? [];
    list.push(clip);
    clipsByLane.set(clip.laneId, list);
  }

  for (const [laneId, laneClips] of clipsByLane) {
    const lane = doc.lanes.find((l) => l.id === laneId);
    if (!lane) continue;
    if (lane.kind === "visual" && lane.policy?.allowOverlap) continue;

    for (let i = 0; i < laneClips.length; i++) {
      for (let j = i + 1; j < laneClips.length; j++) {
        const c1 = laneClips[i];
        const c2 = laneClips[j];
        if (clipsOverlap(c1.startTime, c1.duration, c2.startTime, c2.duration)) {
          violations.push({
            reason: "clip_overlap_violation",
            message: `Xảy ra va chạm thời gian giữa clip "${c1.name}" (${c1.startTime}s - ${c1.startTime + c1.duration}s) và clip "${c2.name}" (${c2.startTime}s - ${c2.startTime + c2.duration}s) trên lane "${lane.name}".`,
            details: { laneId, clipId1: c1.id, clipId2: c2.id },
          });
        }
      }
    }
  }

  if (violations.length > 0) {
    return { valid: false, violations };
  }
  return { valid: true };
}
