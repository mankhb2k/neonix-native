import type { MotionLayer, MotionProject } from "@motionvideo/motion-protocol";
import { resolveGroupPath } from "../../document/group-path";
import { rangesOverlap } from "../policies/placement-policy";
import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
} from "../model/timeline-types";

export type TimelineProjection = {
  lanes: TimelineLane[];
  clips: TimelineClip[];
};

function rootLayersOf(project: MotionProject): MotionLayer[] {
  return project.layers.filter((layer) => layer.parentLayerId === null);
}

function visualRoots(layers: readonly MotionLayer[]): MotionLayer[] {
  return layers.filter((layer) => layer.type !== "audio");
}

function audioRoots(layers: readonly MotionLayer[]): Array<
  Extract<MotionLayer, { type: "audio" }>
> {
  return layers.filter(
    (layer): layer is Extract<MotionLayer, { type: "audio" }> =>
      layer.type === "audio",
  );
}

function baseLane(): TimelineLane {
  return {
    id: "lane.main",
    kind: "visual",
    role: "base",
    order: -1,
    name: "Main",
    policy: { ...DEFAULT_VISUAL_POLICY },
  };
}

function overlayLane(index: number): TimelineLane {
  return {
    id: `lane.overlay.${index}`,
    kind: "visual",
    role: "overlay",
    order: index,
    name: `Overlay ${index + 1}`,
    policy: { ...DEFAULT_VISUAL_POLICY },
  };
}

function audioLane(index: number): TimelineLane {
  return {
    id: index === 0 ? "lane.audio" : `lane.audio.${index}`,
    kind: "audio",
    role: "audio",
    order: index,
    name: index === 0 ? "Audio" : `Audio ${index + 1}`,
  };
}

function laneIsFree(
  clips: TimelineClip[],
  laneId: string,
  start: number,
  duration: number,
): boolean {
  return !clips.some(
    (clip) =>
      clip.laneId === laneId &&
      rangesOverlap(start, duration, clip.startTime, clip.duration),
  );
}

function sceneClipFromLayer(
  layer: MotionLayer,
  laneId: string,
  startTime: number,
): TimelineClip {
  return {
    id: layer.id,
    kind: "scene",
    sceneId: layer.id,
    laneId,
    startTime,
    duration: layer.timing.duration,
    name: layer.name ?? layer.id,
  };
}

function audioClipFromLayer(
  layer: Extract<MotionLayer, { type: "audio" }>,
  laneId: string,
): TimelineClip {
  return {
    id: layer.id,
    kind: "audio",
    audioTrackId: layer.id,
    assetId: layer.payload.assetId,
    laneId,
    startTime: layer.timing.start,
    duration: layer.timing.duration,
    name: layer.name ?? layer.id,
  };
}

/**
 * Greedy interval pack: place each layer on the lowest lane that does not
 * overlap in time. Sharing a lane is display-only — it does not create a group.
 */
export function packRootLayersToTimeline(
  project: MotionProject,
): TimelineProjection {
  const roots = rootLayersOf(project);
  const visual = [...visualRoots(roots)].sort(
    (a, b) => a.zIndex - b.zIndex || a.timing.start - b.timing.start,
  );
  const audio = [...audioRoots(roots)].sort(
    (a, b) => b.zIndex - a.zIndex || a.timing.start - b.timing.start,
  );

  const visualLanes: TimelineLane[] = [baseLane()];
  const clips: TimelineClip[] = [];

  for (const layer of visual) {
    let laneId: string | null = null;
    for (const lane of visualLanes) {
      if (
        laneIsFree(clips, lane.id, layer.timing.start, layer.timing.duration)
      ) {
        laneId = lane.id;
        break;
      }
    }
    if (!laneId) {
      const overlay = overlayLane(
        visualLanes.filter((l) => l.role === "overlay").length,
      );
      visualLanes.push(overlay);
      laneId = overlay.id;
    }
    clips.push(sceneClipFromLayer(layer, laneId, layer.timing.start));
  }

  const audioLanes: TimelineLane[] = [];
  for (const layer of audio) {
    let laneId: string | null = null;
    for (const lane of audioLanes) {
      if (
        laneIsFree(clips, lane.id, layer.timing.start, layer.timing.duration)
      ) {
        laneId = lane.id;
        break;
      }
    }
    if (!laneId) {
      const created = audioLane(audioLanes.length);
      audioLanes.push(created);
      laneId = created.id;
    }
    clips.push(audioClipFromLayer(layer, laneId));
  }

  return { lanes: [...visualLanes, ...audioLanes], clips };
}

/**
 * Protocol stack for preview: one unique root zIndex → one visual lane.
 * Overlapping audio still packs onto free audio lanes so the document validates.
 */
export function stackRootLayersToTimeline(
  project: MotionProject,
): TimelineProjection {
  const roots = rootLayersOf(project);
  const visual = visualRoots(roots);
  const audio = audioRoots(roots);
  const lanes: TimelineLane[] = [baseLane()];
  const clips: TimelineClip[] = [];

  const overlayZ = [
    ...new Set(visual.filter((layer) => layer.zIndex > 0).map((l) => l.zIndex)),
  ].sort((a, b) => a - b);

  for (const layer of visual) {
    clips.push(
      sceneClipFromLayer(
        layer,
        layer.zIndex === 0 ? "lane.main" : `lane.overlay.${layer.zIndex}`,
        layer.timing.start,
      ),
    );
  }

  overlayZ.forEach((z, idx) => {
    lanes.push({
      id: `lane.overlay.${z}`,
      kind: "visual",
      role: "overlay",
      order: idx,
      name: `Overlay ${idx + 1}`,
      policy: { ...DEFAULT_VISUAL_POLICY },
    });
  });

  const audioLanes: TimelineLane[] = [];
  for (const layer of audio) {
    let laneId: string | null = null;
    for (const lane of audioLanes) {
      if (
        laneIsFree(clips, lane.id, layer.timing.start, layer.timing.duration)
      ) {
        laneId = lane.id;
        break;
      }
    }
    if (!laneId) {
      const created = audioLane(audioLanes.length);
      audioLanes.push(created);
      laneId = created.id;
    }
    clips.push(audioClipFromLayer(layer, laneId));
  }

  return { lanes: [...lanes, ...audioLanes], clips };
}

/**
 * Group surface: direct children only, one child per row, no packing, no audio.
 * Clip times are composition-global (`timeOffset + child.timing.start`).
 */
export function groupPathToTimelineClips(
  project: MotionProject,
  groupPath: readonly string[],
): TimelineProjection & { timeOffset: number } {
  const { layers, timeOffset } = resolveGroupPath(project.layers, groupPath);
  const visual = [...visualRoots(layers)].sort(
    (a, b) => a.zIndex - b.zIndex || a.timing.start - b.timing.start,
  );

  const lanes: TimelineLane[] = [baseLane()];
  const clips: TimelineClip[] = [];

  visual.forEach((layer, index) => {
    const lane =
      index === 0
        ? lanes[0]!
        : overlayLane(index - 1);
    if (index > 0) lanes.push(lane);
    clips.push(
      sceneClipFromLayer(layer, lane.id, timeOffset + layer.timing.start),
    );
  });

  return { lanes, clips, timeOffset };
}

/**
 * Derive timeline lanes + clips from `project.layers` root layers.
 *
 * Main view packs non-overlapping visual roots onto shared lanes. Clip id =
 * layer id. Audio uses unique negative zIndex and extra lanes when they overlap.
 */
export function visualTracksToTimelineClips(
  project: MotionProject,
): TimelineProjection {
  return packRootLayersToTimeline(project);
}

/**
 * Re-apply a previous packing envelope (clip id / laneId) onto a fresh pack
 * when the same layers still exist and the remembered lane is free.
 */
export function mergeEnvelopeLaneMembership(
  packed: TimelineProjection,
  envelopeClips: readonly TimelineClip[],
  envelopeLanes: readonly TimelineLane[],
): TimelineProjection {
  if (envelopeClips.length === 0 || envelopeLanes.length === 0) return packed;

  const envelopeByLayer = new Map<string, TimelineClip>();
  for (const clip of envelopeClips) {
    const layerId =
      clip.kind === "scene" ? clip.sceneId : (clip.audioTrackId ?? clip.id);
    envelopeByLayer.set(layerId, clip);
  }

  const laneIds = new Set(envelopeLanes.map((lane) => lane.id));
  const hasBase = envelopeLanes.some(
    (lane) => lane.kind === "visual" && lane.role === "base",
  );
  const lanes: TimelineLane[] = hasBase
    ? [...envelopeLanes]
    : [baseLane(), ...envelopeLanes];
  const placed: TimelineClip[] = [];

  for (const packedClip of packed.clips) {
    const layerId =
      packedClip.kind === "scene"
        ? packedClip.sceneId
        : (packedClip.audioTrackId ?? packedClip.id);
    const remembered = envelopeByLayer.get(layerId);
    const rememberedLaneOk =
      remembered &&
      laneIds.has(remembered.laneId) &&
      laneIsFree(
        placed,
        remembered.laneId,
        packedClip.startTime,
        packedClip.duration,
      );

    if (remembered && rememberedLaneOk) {
      placed.push({
        ...packedClip,
        id: remembered.id,
        laneId: remembered.laneId,
        name: remembered.name || packedClip.name,
      });
      continue;
    }

    let laneId = packedClip.laneId;
    if (!lanes.some((lane) => lane.id === laneId)) {
      const extra = packed.lanes.find((lane) => lane.id === laneId);
      if (extra) lanes.push(extra);
    }
    if (
      !laneIsFree(placed, laneId, packedClip.startTime, packedClip.duration)
    ) {
      const family = packedClip.kind === "audio" ? "audio" : "visual";
      const candidate = lanes.find(
        (lane) =>
          (family === "audio" ? lane.kind === "audio" : lane.kind === "visual") &&
          laneIsFree(placed, lane.id, packedClip.startTime, packedClip.duration),
      );
      if (candidate) {
        laneId = candidate.id;
      } else {
        const packedLane = packed.lanes.find((lane) => lane.id === packedClip.laneId);
        if (packedLane && !lanes.some((lane) => lane.id === packedLane.id)) {
          lanes.push(packedLane);
        }
        laneId = packedClip.laneId;
      }
    }
    placed.push({ ...packedClip, laneId });
  }

  return { lanes, clips: placed };
}
