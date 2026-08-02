import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
  type VisualLanePolicy,
} from "../model/timeline-types";

/** Strict: absent/undefined ok; present non-boolean → throw. */
function assertOptionalBoolean(value: unknown, path: string): void {
  if (value === undefined) return;
  if (typeof value !== "boolean") {
    throw new TimelineParseError(`${path} must be a boolean when present.`);
  }
}

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

export class TimelineParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimelineParseError";
  }
}

function assertArray(input: unknown, label: string): unknown[] {
  if (!Array.isArray(input)) {
    throw new TimelineParseError(`${label} must be an array.`);
  }
  return input;
}

/** Soft minimum for strict open/save — matches editor slice floor. */
const MIN_CLIP_DURATION_STRICT = 0.05;

/** Strict lane parse — canonical visual/audio only; no legacy migrate or soft defaults. */
export function parseTimelineLanesStrict(input: unknown): TimelineLane[] {
  const items = assertArray(input, "timelineLanes");
  const lanes: TimelineLane[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== "object") {
      throw new TimelineParseError(`timelineLanes[${i}] is not an object.`);
    }
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || row.id.length === 0) {
      throw new TimelineParseError(`timelineLanes[${i}].id must be a non-empty string.`);
    }
    if (typeof row.name !== "string" || row.name.length === 0) {
      throw new TimelineParseError(
        `timelineLanes[${i}].name must be a non-empty string.`,
      );
    }
    if (
      !validNumber(row.order) ||
      !Number.isInteger(row.order)
    ) {
      throw new TimelineParseError(
        `timelineLanes[${i}].order must be a finite integer.`,
      );
    }
    assertOptionalBoolean(row.locked, `timelineLanes[${i}].locked`);
    const locked = row.locked === true;
    if (row.kind === "visual") {
      if (row.role !== "base" && row.role !== "overlay") {
        throw new TimelineParseError(
          `timelineLanes[${i}].role must be "base" or "overlay" for visual lanes.`,
        );
      }
      if (row.policy != null && typeof row.policy !== "object") {
        throw new TimelineParseError(
          `timelineLanes[${i}].policy must be an object when present.`,
        );
      }
      const policyRaw =
        row.policy && typeof row.policy === "object"
          ? (row.policy as Record<string, unknown>)
          : null;
      if (policyRaw) {
        assertOptionalBoolean(
          policyRaw.rippleMode,
          `timelineLanes[${i}].policy.rippleMode`,
        );
      }
      assertOptionalBoolean(row.visible, `timelineLanes[${i}].visible`);
      lanes.push({
        id: row.id,
        kind: "visual",
        role: row.role,
        name: row.name,
        order: row.order,
        policy: {
          allowOverlap: false,
          rippleMode: policyRaw?.rippleMode === true,
        },
        ...(locked ? { locked: true } : {}),
        ...(row.visible === false ? { visible: false } : {}),
      });
      continue;
    }
    if (row.kind === "audio") {
      if (row.role != null && row.role !== "audio") {
        throw new TimelineParseError(
          `timelineLanes[${i}].role must be "audio" when set on audio lanes.`,
        );
      }
      assertOptionalBoolean(row.muted, `timelineLanes[${i}].muted`);
      lanes.push({
        id: row.id,
        kind: "audio",
        role: "audio",
        name: row.name,
        order: row.order,
        ...(locked ? { locked: true } : {}),
        ...(row.muted === true ? { muted: true } : {}),
      });
      continue;
    }
    throw new TimelineParseError(
      `timelineLanes[${i}].kind must be "visual" or "audio" (legacy kinds rejected).`,
    );
  }
  return lanes;
}

/** Strict clip parse — canonical scene/audio only; no clamp, invent, or legacy track. */
export function parseTimelineClipsStrict(input: unknown): TimelineClip[] {
  const items = assertArray(input, "timelineClips");
  const clips: TimelineClip[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== "object") {
      throw new TimelineParseError(`timelineClips[${i}] is not an object.`);
    }
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || row.id.length === 0) {
      throw new TimelineParseError(`timelineClips[${i}].id must be a non-empty string.`);
    }
    if (typeof row.name !== "string" || row.name.length === 0) {
      throw new TimelineParseError(
        `timelineClips[${i}].name must be a non-empty string.`,
      );
    }
    if (typeof row.laneId !== "string" || row.laneId.length === 0) {
      throw new TimelineParseError(
        `timelineClips[${i}].laneId must be a non-empty string.`,
      );
    }
    if (!validNumber(row.startTime) || row.startTime < 0) {
      throw new TimelineParseError(
        `timelineClips[${i}].startTime must be a finite number >= 0.`,
      );
    }
    if (
      !validNumber(row.duration) ||
      row.duration < MIN_CLIP_DURATION_STRICT
    ) {
      throw new TimelineParseError(
        `timelineClips[${i}].duration must be a finite number >= ${MIN_CLIP_DURATION_STRICT}.`,
      );
    }
    if (row.kind === "scene") {
      if (typeof row.sceneId !== "string" || row.sceneId.length === 0) {
        throw new TimelineParseError(
          `timelineClips[${i}].sceneId must be a non-empty string.`,
        );
      }
      clips.push({
        id: row.id,
        kind: "scene",
        sceneId: row.sceneId,
        laneId: row.laneId,
        startTime: row.startTime,
        duration: row.duration,
        name: row.name,
      });
      continue;
    }
    if (row.kind === "audio") {
      if (typeof row.audioTrackId !== "string" || row.audioTrackId.length === 0) {
        throw new TimelineParseError(
          `timelineClips[${i}].audioTrackId must be a non-empty string.`,
        );
      }
      if (typeof row.assetId !== "string" || row.assetId.length === 0) {
        throw new TimelineParseError(
          `timelineClips[${i}].assetId must be a non-empty string.`,
        );
      }
      clips.push({
        id: row.id,
        kind: "audio",
        audioTrackId: row.audioTrackId,
        assetId: row.assetId,
        laneId: row.laneId,
        startTime: row.startTime,
        duration: row.duration,
        name: row.name,
      });
      continue;
    }
    throw new TimelineParseError(
      `timelineClips[${i}].kind must be "scene" or "audio".`,
    );
  }
  return clips;
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
