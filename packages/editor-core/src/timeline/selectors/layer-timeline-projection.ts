import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
} from "../model/timeline-types";

export type LayerTimelineProjection = {
  lanes: TimelineLane[];
  clips: TimelineClip[];
  duration: number;
};

const MAIN_LANE_ID = "lane.main";

type RootLayer = MotionProtocolV2["layers"][number];
type VisualPackLane = {
  id: string;
  layers: RootLayer[];
};

function overlaps(left: RootLayer, right: RootLayer): boolean {
  const leftEnd = left.timing.start + left.timing.duration;
  const rightEnd = right.timing.start + right.timing.duration;
  return left.timing.start < rightEnd && right.timing.start < leftEnd;
}

/**
 * Timeline rows are editorial packing only, not the V2 paint stack. Root
 * layers that do not overlap in time share a row; every layer keeps its own
 * `order` in the protocol for deterministic composition rendering.
 */
function packRootLayers(rootLayers: RootLayer[]): VisualPackLane[] {
  const packed: VisualPackLane[] = [];
  for (const layer of [...rootLayers].sort((left, right) => left.order - right.order)) {
    const target = packed.find((lane) =>
      lane.layers.every((existing) => !overlaps(existing, layer)),
    );
    if (target) {
      target.layers.push(layer);
      continue;
    }
    packed.push({
      id: layer.order === 0 ? MAIN_LANE_ID : `lane.visual.${layer.id}`,
      layers: [layer],
    });
  }
  return packed;
}

function laneOrder(lane: VisualPackLane): number {
  return Math.max(...lane.layers.map((layer) => layer.order));
}

/**
 * Project Protocol V2 into the existing timeline view-model.
 *
 * Visual clips are packed into the fewest timeline rows that keep temporal
 * intervals disjoint. This is independent from `layer.order`: order continues
 * to control the stage paint stack. Audio tracks always follow visual rows and
 * use negative lane orders (-1, -2, ...) for the root timeline contract.
 */
export function projectLayersToTimeline(
  project: MotionProtocolV2,
): LayerTimelineProjection {
  const rootLayers = project.layers.filter((layer) => layer.parentLayerId === null);
  const packedVisualLanes = packRootLayers(rootLayers);
  const laneIdByLayerId = new Map<string, string>();
  for (const lane of packedVisualLanes) {
    for (const layer of lane.layers) laneIdByLayerId.set(layer.id, lane.id);
  }

  const visualLanes: TimelineLane[] = packedVisualLanes
    .map((lane) => {
      const order = laneOrder(lane);
      const includesMain = lane.layers.some((layer) => layer.order === 0);
      return {
        id: lane.id,
        kind: "visual" as const,
        role: includesMain ? "base" as const : "overlay" as const,
        order,
        name: includesMain ? "Main" : lane.layers[0]!.id,
        policy: { ...DEFAULT_VISUAL_POLICY },
      };
    })
    .sort((left, right) => right.order - left.order);

  if (!rootLayers.some((layer) => layer.order === 0)) {
    visualLanes.push({
      id: MAIN_LANE_ID,
      kind: "visual",
      role: "base",
      order: 0,
      name: "Main",
      policy: { ...DEFAULT_VISUAL_POLICY },
    });
  }

  const visualClips: TimelineClip[] = rootLayers.map((layer) => ({
    id: layer.id,
    kind: "scene",
    sceneId: layer.id,
    laneId: laneIdByLayerId.get(layer.id) ?? MAIN_LANE_ID,
    startTime: layer.timing.start,
    duration: layer.timing.duration,
    name: layer.id,
  }));

  const audioLanes: TimelineLane[] = project.audio.tracks.map(
    (track, index) => ({
      id: `lane.audio.${track.id}`,
      kind: "audio",
      role: "audio",
      order: -(index + 1),
      name: track.id,
      muted: track.muted,
    }),
  );
  const audioClips: TimelineClip[] = project.audio.tracks.flatMap((track) =>
    track.clips.map((clip) => ({
      id: `audio.${clip.id}`,
      kind: "audio" as const,
      audioTrackId: track.id,
      assetId: clip.assetId,
      laneId: `lane.audio.${track.id}`,
      startTime: clip.timing.start,
      duration: clip.timing.duration,
      name: clip.id,
    })),
  );

  const clips = [...visualClips, ...audioClips];
  const duration = clips.reduce(
    (end, clip) => Math.max(end, clip.startTime + clip.duration),
    0,
  );

  return { lanes: [...visualLanes, ...audioLanes], clips, duration };
}

export { MAIN_LANE_ID };
