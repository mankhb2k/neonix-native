import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
  type TimelinePosterStatus,
} from "../model/timeline-types";

/** Protocol V2 stores authoring time in milliseconds; timeline UI uses seconds. */
const protocolMillisecondsToSeconds = (value: number): number => value / 1000;

export type LayerTimelineProjection = {
  lanes: TimelineLane[];
  clips: TimelineClip[];
  duration: number;
};

export type TimelineAssetPreview = {
  url?: string | null;
  status?: TimelinePosterStatus | null;
};

export type TimelineProjectionOptions = {
  /** Ephemeral editor metadata; never serialized into Protocol V2. */
  assetPreviews?: ReadonlyMap<string, TimelineAssetPreview>;
};

const MAIN_LANE_ID = "lane.main";

type RootLayer = MotionProtocolV2["layers"][number];
type VisualLane = {
  id: string;
  layers: RootLayer[];
};

/**
 * At the V2 root, order is the persistent lane contract: order 0 is Main and
 * every non-zero sibling is shown on its own overlay lane. We must not pack
 * non-overlapping clips back into Main, because that would erase the user's
 * vertical drag intent after the document has correctly updated its order.
 */
function lanesFromRootOrder(rootLayers: RootLayer[]): VisualLane[] {
  return [...rootLayers]
    .sort((left, right) => left.order - right.order)
    .map((layer) => ({
      id: layer.order === 0 ? MAIN_LANE_ID : `lane.visual.${layer.id}`,
      layers: [layer],
    }));
}

function laneOrder(lane: VisualLane): number {
  return Math.max(...lane.layers.map((layer) => layer.order));
}

/**
 * Project Protocol V2 into the existing timeline view-model.
 *
 * Root order controls both V2 paint order and the visible lane stack: Main is
 * order 0, visual overlays are above it, and audio tracks are below it with
 * negative lane orders (-1, -2, ...). Audio tracks always follow visual rows.
 */
export function projectLayersToTimeline(
  project: MotionProtocolV2,
  options: TimelineProjectionOptions = {},
): LayerTimelineProjection {
  const assetPreviews = options.assetPreviews;
  const rootLayers = project.layers.filter((layer) => layer.parentLayerId === null);
  const visualLanesByOrder = lanesFromRootOrder(rootLayers);
  const laneIdByLayerId = new Map<string, string>();
  for (const lane of visualLanesByOrder) {
    for (const layer of lane.layers) laneIdByLayerId.set(layer.id, lane.id);
  }

  const visualLanes: TimelineLane[] = visualLanesByOrder
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
    mediaType:
      layer.type === "image" ||
      layer.type === "video" ||
      layer.type === "shape" ||
      layer.type === "text"
        ? layer.type
        : undefined,
    ...(layer.type === "video"
      ? {
          muted: layer.payload.audio ? !layer.payload.audio.enabled : false,
          embeddedAudio: Boolean(layer.payload.audio),
          trimStart: protocolMillisecondsToSeconds(layer.payload.trimStart ?? 0),
          ...(() => {
            const asset = project.assets.find((candidate) => candidate.id === layer.payload.assetId);
            const preview = assetPreviews?.get(layer.payload.assetId);
            if (asset?.kind === "video") {
              return {
                ...(asset.duration !== undefined ? { sourceDuration: protocolMillisecondsToSeconds(asset.duration) } : {}),
                ...(preview?.url ? { posterUrl: preview.url } : {}),
                posterStatus: preview?.status ?? "pending",
              };
            }
            return {};
          })(),
        }
      : layer.type === "image"
        ? (() => {
            const asset = project.assets.find((candidate) => candidate.id === layer.payload.assetId);
            const preview = assetPreviews?.get(layer.payload.assetId);
            return asset?.kind === "image"
              ? {
                  posterUrl: preview?.url ?? asset.uri,
                  posterStatus: preview?.status ?? "ready",
                }
              : {};
          })()
      : {}),
    laneId: laneIdByLayerId.get(layer.id) ?? MAIN_LANE_ID,
    startTime: protocolMillisecondsToSeconds(layer.timing.start),
    duration: protocolMillisecondsToSeconds(layer.timing.duration),
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
      startTime: protocolMillisecondsToSeconds(clip.timing.start),
      duration: protocolMillisecondsToSeconds(clip.timing.duration),
      name: clip.id,
      muted: track.muted,
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
