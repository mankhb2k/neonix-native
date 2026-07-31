import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
  type VisualLanePolicy,
} from "@/lib/editor/model/timeline-types";

function validNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parsePolicy(raw: unknown): VisualLanePolicy {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_VISUAL_POLICY };
  const row = raw as Record<string, unknown>;
  return {
    allowOverlap: false,
    rippleMode: row.rippleMode === true,
  };
}

/** Parse lane — chấp nhận legacy main/overlay/audio và visual+role. */
export function parseTimelineLanes(input: unknown): TimelineLane[] {
  if (!Array.isArray(input)) return [];
  const lanes: TimelineLane[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.name !== "string" ||
      !validNumber(row.order)
    ) {
      continue;
    }
    const order = Math.floor(row.order);
    const locked = row.locked === true;
    const visible = row.visible !== false;
    const muted = row.muted === true;

    // Format mới
    if (
      row.kind === "visual" &&
      (row.role === "base" || row.role === "overlay")
    ) {
      lanes.push({
        id: row.id,
        kind: "visual",
        role: row.role,
        name: row.name,
        order,
        policy: parsePolicy(row.policy),
        ...(locked ? { locked: true } : {}),
        ...(row.visible === false ? { visible: false } : {}),
      });
      continue;
    }
    if (
      row.kind === "audio" ||
      (row.kind === "audio" && row.role === "audio")
    ) {
      lanes.push({
        id: row.id,
        kind: "audio",
        role: "audio",
        name: row.name,
        order,
        ...(locked ? { locked: true } : {}),
        ...(muted ? { muted: true } : {}),
      });
      continue;
    }

    // Legacy: main / overlay / audio
    if (row.kind === "main") {
      lanes.push({
        id: row.id,
        kind: "visual",
        role: "base",
        name: row.name,
        order,
        policy: { ...DEFAULT_VISUAL_POLICY },
      });
      continue;
    }
    if (row.kind === "overlay") {
      lanes.push({
        id: row.id,
        kind: "visual",
        role: "overlay",
        name: row.name,
        order,
        policy: { ...DEFAULT_VISUAL_POLICY },
        ...(visible === false ? { visible: false } : {}),
        ...(locked ? { locked: true } : {}),
      });
      continue;
    }
    if (row.kind === "audio") {
      lanes.push({
        id: row.id,
        kind: "audio",
        role: "audio",
        name: row.name,
        order,
        ...(locked ? { locked: true } : {}),
        ...(muted ? { muted: true } : {}),
      });
    }
  }
  return lanes;
}

/** Parse clips — chấp nhận kind mới và legacy sceneId-only. */
export function parseTimelineClips(input: unknown): TimelineClip[] {
  if (!Array.isArray(input)) return [];
  const clips: TimelineClip[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.name !== "string" ||
      !validNumber(row.startTime) ||
      !validNumber(row.duration)
    ) {
      continue;
    }
    const hasLaneId = typeof row.laneId === "string";
    const hasLegacyTrack =
      row.track === "main" || row.track === "overlay" || row.track === "audio";
    if (!hasLaneId && !hasLegacyTrack) continue;

    const startTime = Math.max(0, row.startTime);
    const duration = Math.max(0, row.duration);
    const laneId = hasLaneId ? (row.laneId as string) : "";

    // Audio clip mới
    if (
      row.kind === "audio" ||
      row.track === "audio" ||
      (typeof row.audioTrackId === "string" && typeof row.assetId === "string")
    ) {
      const audioTrackId =
        typeof row.audioTrackId === "string"
          ? row.audioTrackId
          : typeof row.sceneId === "string"
            ? row.sceneId
            : row.id;
      const assetId =
        typeof row.assetId === "string"
          ? row.assetId
          : typeof row.name === "string"
            ? row.name
            : audioTrackId;
      clips.push({
        id: row.id,
        kind: "audio",
        audioTrackId,
        assetId,
        laneId,
        startTime,
        duration,
        name: row.name,
      });
      continue;
    }

    // Scene clip (mặc định)
    const sceneId = typeof row.sceneId === "string" ? row.sceneId : row.id;
    clips.push({
      id: row.id,
      kind: "scene",
      sceneId,
      laneId,
      startTime,
      duration,
      name: row.name,
    });
  }
  return clips;
}
