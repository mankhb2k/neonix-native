/**
 * Bake editor timeline → MotionProject V1 tuần tự hợp lệ cho export/compiler.
 * Overlay compose ngoài schema — flatten theo interval với local-time slice.
 *
 * Phase 8: Outputs V1 visualTracks directly.
 */

import {
  deriveTimelineDurationV1,
  parseMotionProject,
  visualLayerAtoms,
  type MotionLayer,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import {
  documentFromStoreState,
  validateTimelineDocument,
} from "../document/document";
import {
  isAudioClip,
  isSceneClip,
  type TimelineClip,
  type TimelineLane,
} from "../timeline/model/timeline-types";
import {
  composeVisualLayersAtTime,
  findActiveClipAtTime,
} from "../preview/compose-layers";
import { buildAudioLayer } from "../timeline/internal/timeline-project-sync";
import { clipLocalTime, sliceScene } from "./slice-scene";

export type EditorExportSnapshot = {
  project: MotionProject;
  timelineClips: TimelineClip[];
  timelineLanes: TimelineLane[];
};

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyPadLayer(
  id: string,
  duration: number,
  name: string,
  width: number,
  height: number,
): MotionLayer {
  const dur = Math.max(0.001, duration);
  return {
    id,
    type: "group",
    name,
    parentLayerId: null,
    zIndex: 0,
    ...visualLayerAtoms({ width, height }),
    timing: { start: 0, duration: dur },
    children: [
      {
        id: uid("pad-solid"),
        type: "solid",
        name: "Pad",
        parentLayerId: id,
        zIndex: 0,
        ...visualLayerAtoms({ width, height, opacity: 0, visible: false }),
        timing: { start: 0, duration: dur },
        payload: { color: "#000000" },
      },
    ],
  };
}

function remapChildren(
  children: MotionLayer[],
  idMap: Map<string, string>,
): MotionLayer[] {
  return children.map((node) => {
    const nested =
      node.type === "group" ? remapChildren(node.children, idMap) : undefined;
    return {
      ...node,
      id: idMap.get(node.id) ?? node.id,
      parentLayerId: node.parentLayerId
        ? (idMap.get(node.parentLayerId) ?? node.parentLayerId)
        : null,
      ...(nested ? { children: nested } : {}),
    } as MotionLayer;
  });
}

/** Remap overlay group children vào base group (IDs mới, giữ parent graph). */
function mergeOverlayNodes(
  base: MotionLayer,
  overlay: MotionLayer,
  tag: string,
): MotionLayer {
  const idMap = new Map<string, string>();
  const overlayChildren = overlay.type === "group" ? overlay.children : [];
  for (const node of overlayChildren) {
    idMap.set(node.id, `${node.id}__${tag}`);
  }
  const remapped = remapChildren(overlayChildren, idMap);
  const baseChildren = base.type === "group" ? base.children : [];
  return {
    ...base,
    type: "group" as const,
    children: [...baseChildren, ...remapped],
  } as MotionLayer;
}

/**
 * Re-base a baked group so the output is a valid V1 layer graph:
 * - descendants get fresh, segment-unique ids (scene reused across segments),
 * - `parentLayerId` rewritten to the new baked ids (was pointing at source ids),
 * - sibling `zIndex` reassigned deterministically (overlay merge collides at 0),
 * - child `timing` clamped to its parent's duration (slice shortens the parent).
 */
function rebaseBakedScene(scene: MotionLayer): MotionLayer {
  if (scene.type !== "group") return scene;
  const rootId = scene.id;
  const rootDuration = scene.timing.duration;

  const walk = (
    nodes: MotionLayer[],
    parentId: string,
    parentDuration: number,
  ): MotionLayer[] =>
    nodes.map((node, index) => {
      const nextId = `${rootId}.${node.id}`;
      const duration = Math.max(
        0.001,
        Math.min(node.timing.duration, parentDuration),
      );
      const children =
        node.type === "group"
          ? walk(node.children, nextId, duration)
          : undefined;
      return {
        ...node,
        id: nextId,
        parentLayerId: parentId,
        zIndex: index,
        timing: { start: 0, duration },
        ...(children ? { children } : {}),
      } as MotionLayer;
    });

  return {
    ...scene,
    children: walk(scene.children, rootId, rootDuration),
  } as MotionLayer;
}

function collectBoundaryTimes(
  clips: TimelineClip[],
  lanes: TimelineLane[],
): number[] {
  const visibleLaneIds = new Set(
    lanes
      .filter(
        (lane) =>
          lane.kind === "visual" &&
          (lane.role === "base" || lane.role === "overlay") &&
          lane.visible !== false,
      )
      .map((lane) => lane.id),
  );
  const times = new Set<number>([0]);
  for (const clip of clips) {
    if (!isSceneClip(clip) || !visibleLaneIds.has(clip.laneId)) continue;
    times.add(Math.max(0, clip.startTime));
    times.add(Math.max(0, clip.startTime + clip.duration));
  }
  return [...times].sort((a, b) => a - b);
}

function buildAudioLayers(
  project: MotionProject,
  clips: TimelineClip[],
  lanes: TimelineLane[],
): MotionLayer[] {
  const mutedLanes = new Set(
    lanes
      .filter((lane) => lane.kind === "audio" && lane.muted)
      .map((lane) => lane.id),
  );
  const byLayerId = new Map(
    project.layers
      .filter(
        (layer): layer is Extract<MotionLayer, { type: "audio" }> =>
          layer.type === "audio",
      )
      .map((layer) => [layer.id, layer]),
  );
  return clips.filter(isAudioClip).map((clip) => {
    const existing = byLayerId.get(clip.audioTrackId);
    const muted = mutedLanes.has(clip.laneId);
    const asset = project.assets?.find((a) => a.id === clip.assetId);
    return buildAudioLayer({
      id: clip.audioTrackId,
      assetId: clip.assetId,
      name: existing?.name,
      start: clip.startTime,
      duration: asset && "duration" in asset ? asset.duration : clip.duration,
      trimStart: existing?.payload.trimStart ?? 0,
      volume: muted ? 0 : (existing?.payload.volume ?? 100),
      loop: existing?.payload.loop ?? false,
      fadeIn: existing?.payload.fadeIn ?? 0,
      fadeOut: existing?.payload.fadeOut ?? 0,
      muted,
    });
  });
}

function findClipById(
  clips: TimelineClip[],
  clipId: string,
): TimelineClip | undefined {
  return clips.find((clip) => clip.id === clipId);
}

/**
 * Flatten editor snapshot → MotionProject V1 tuần tự.
 * Base gaps → pad scenes; overlay active → merge layers vào segment.
 * Rejects invalid TimelineDocument when validation fails.
 */
export function buildExportProject(
  snapshot: EditorExportSnapshot,
): MotionProject {
  const { project, timelineClips, timelineLanes } = snapshot;
  const { width, height } = project.composition;
  const doc = documentFromStoreState({
    project,
    timelineClips,
    timelineLanes,
  });
  if (doc) {
    const validation = validateTimelineDocument(doc);
    if (!validation.valid) {
      throw new Error(
        `Invalid TimelineDocument for export: ${validation.violations
          .map((v) => v.reason)
          .join(", ")}`,
      );
    }
  }

  const scenesById = new Map(
    project.layers
      .filter((layer) => layer.type !== "audio")
      .map((scene) => [scene.id, scene]),
  );
  const boundaries = collectBoundaryTimes(timelineClips, timelineLanes);
  const contentEnd = timelineClips.reduce(
    (end, clip) => Math.max(end, clip.startTime + clip.duration),
    0,
  );
  const audioLayers = buildAudioLayers(project, timelineClips, timelineLanes);

  if (boundaries.length === 0 || contentEnd <= 0) {
    const existingScene = project.layers.find(
      (layer) => layer.type !== "audio",
    );
    const fallback =
      existingScene ?? emptyPadLayer(uid("pad"), 0.5, "Empty", width, height);
    const fallbackLayer: MotionLayer = {
      ...fallback,
      timing: {
        start: 0,
        duration: Math.max(0.5, fallback.timing.duration),
      },
    };
    const layers = [fallbackLayer, ...audioLayers];
    return parseMotionProject({
      ...project,
      layers,
      timeline: { duration: deriveTimelineDurationV1(layers) },
    });
  }

  const lastBoundary = boundaries[boundaries.length - 1] ?? 0;
  if (lastBoundary < contentEnd) {
    boundaries.push(contentEnd);
  }

  const bakedScenes: Array<{
    layer: MotionLayer;
    start: number;
    duration: number;
  }> = [];
  let clipCursor = 0;

  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const t0 = boundaries[i] ?? 0;
    const t1 = boundaries[i + 1] ?? t0;
    const duration = t1 - t0;
    if (duration <= 1e-6) continue;
    const mid = t0 + duration / 2;
    const layers = composeVisualLayersAtTime(timelineClips, timelineLanes, mid);
    const baseLayer = layers.find((layer) => layer.role === "base");
    const overlayLayers = layers.filter((layer) => layer.role === "overlay");

    let scene: MotionLayer;
    if (baseLayer) {
      const source = scenesById.get(baseLayer.sceneId);
      const baseClip = findClipById(timelineClips, baseLayer.clipId);
      const localStart = baseClip
        ? clipLocalTime(baseClip.startTime, baseClip.duration, t0)
        : 0;
      scene = source
        ? sliceScene(source, localStart, duration)
        : emptyPadLayer(uid("pad"), duration, "Missing base", width, height);
      scene = { ...scene, id: uid("bake") };
      for (const overlay of overlayLayers) {
        const ovScene = scenesById.get(overlay.sceneId);
        if (!ovScene) continue;
        const ovClip = findClipById(timelineClips, overlay.clipId);
        const ovLocal = ovClip
          ? clipLocalTime(ovClip.startTime, ovClip.duration, t0)
          : 0;
        scene = mergeOverlayNodes(
          scene,
          sliceScene(ovScene, ovLocal, duration),
          overlay.clipId,
        );
      }
    } else if (overlayLayers.length > 0) {
      scene = emptyPadLayer(
        uid("bake"),
        duration,
        "Overlay gap",
        width,
        height,
      );
      for (const overlay of overlayLayers) {
        const ovScene = scenesById.get(overlay.sceneId);
        if (!ovScene) continue;
        const ovClip = findClipById(timelineClips, overlay.clipId);
        const ovLocal = ovClip
          ? clipLocalTime(ovClip.startTime, ovClip.duration, t0)
          : 0;
        scene = mergeOverlayNodes(
          scene,
          sliceScene(ovScene, ovLocal, duration),
          overlay.clipId,
        );
      }
    } else {
      scene = emptyPadLayer(uid("bake"), duration, "Gap", width, height);
    }

    bakedScenes.push({
      layer: rebaseBakedScene(scene),
      start: clipCursor,
      duration,
    });
    clipCursor += duration;
  }

  if (bakedScenes.length === 0) {
    bakedScenes.push({
      layer: emptyPadLayer(uid("pad"), 0.5, "Empty", width, height),
      start: 0,
      duration: 0.5,
    });
  }

  const visualLayers = bakedScenes.map((s, index) => ({
    ...s.layer,
    zIndex: index,
    timing: { start: s.start, duration: s.duration },
  }));
  const layers = [...visualLayers, ...audioLayers];

  return parseMotionProject({
    ...project,
    layers,
    timeline: { duration: deriveTimelineDurationV1(layers) },
  });
}

/** Helper test — clip base active tại time (sau bake logic). */
export function findBaseClipAtTimeForExport(
  clips: TimelineClip[],
  lanes: TimelineLane[],
  time: number,
): TimelineClip | undefined {
  const baseId = lanes.find(
    (lane) => lane.kind === "visual" && lane.role === "base",
  )?.id;
  if (!baseId) return undefined;
  const sorted = clips
    .filter((clip) => clip.laneId === baseId && isSceneClip(clip))
    .sort((a, b) => a.startTime - b.startTime);
  return findActiveClipAtTime(sorted, time);
}

/** Map global timeline time → baked layer + local time within that layer. */
export function resolveBakedLocalTime(
  baked: MotionProject,
  globalTime: number,
): { sceneId: string; localTime: number } | null {
  for (const layer of baked.layers) {
    if (layer.type === "audio") continue;
    const start = layer.timing.start;
    const end = start + layer.timing.duration;
    if (globalTime >= start && globalTime < end) {
      return { sceneId: layer.id, localTime: globalTime - start };
    }
  }
  return null;
}
