/**
 * Bake editor timeline → MotionProject tuần tự hợp lệ cho export/compiler.
 * Overlay compose ngoài schema — flatten theo interval với local-time slice.
 */

import {
  parseMotionProject,
  type MotionNode,
  type MotionProject,
  type MotionScene,
} from "@motionvideo/motion-schema";
import {
  composeVisualLayersAtTime,
  findActiveClipAtTime,
} from "@/lib/editor/preview/compose-layers";
import {
  isAudioClip,
  isSceneClip,
  type TimelineClip,
  type TimelineLane,
} from "@/lib/editor/timeline-clips";
import { documentFromStoreState } from "@/lib/editor/timeline/document";
import { validateTimelineDocument } from "@/lib/editor/timeline/document";
import { clipLocalTime, sliceScene } from "@/lib/editor/export/slice-scene";

export type EditorExportSnapshot = {
  project: MotionProject;
  timelineClips: TimelineClip[];
  timelineLanes: TimelineLane[];
};

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyPadScene(id: string, duration: number, name: string): MotionScene {
  return {
    id,
    name,
    duration: Math.max(0.001, duration),
    nodes: [],
    clips: [],
  };
}

/** Remap overlay nodes vào base scene (IDs mới, giữ parent graph). */
function mergeOverlayNodes(
  base: MotionScene,
  overlay: MotionScene,
  tag: string,
): MotionScene {
  const idMap = new Map<string, string>();
  for (const node of overlay.nodes) {
    idMap.set(node.id, `${node.id}__${tag}`);
  }
  const remapId = (id: string | undefined): string | undefined => {
    if (!id) return id;
    return idMap.has(id) ? idMap.get(id)! : id;
  };
  const remappedNodes: MotionNode[] = overlay.nodes.map((node) => ({
    ...node,
    id: idMap.get(node.id)!,
    parentId: remapId(node.parentId ?? undefined) ?? null,
  }));
  const remappedClips = (overlay.clips ?? []).map((clip) => {
    let source = clip.source;
    if (source.kind === "tracks") {
      source = {
        ...source,
        tracks: source.tracks.map((track) => ({
          ...track,
          targetId: remapId(track.targetId) ?? track.targetId,
        })),
      };
    }
    return {
      ...clip,
      id: uid("clip"),
      targetId: remapId(clip.targetId),
      source,
    };
  });
  return {
    ...base,
    nodes: [...base.nodes, ...remappedNodes],
    clips: [...(base.clips ?? []), ...remappedClips],
  };
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

function buildAudioTracks(
  project: MotionProject,
  clips: TimelineClip[],
  lanes: TimelineLane[],
): MotionProject["timeline"]["audioTracks"] {
  const mutedLanes = new Set(
    lanes
      .filter((lane) => lane.kind === "audio" && lane.muted)
      .map((lane) => lane.id),
  );
  const byTrackId = new Map(
    (project.timeline.audioTracks ?? []).map((track) => [track.id, track]),
  );
  return clips.filter(isAudioClip).map((clip) => {
    const existing = byTrackId.get(clip.audioTrackId);
    const muted = mutedLanes.has(clip.laneId);
    return {
      id: clip.audioTrackId,
      role: existing?.role ?? ("bgm" as const),
      assetId: clip.assetId,
      start: clip.startTime,
      trimStart: existing?.trimStart ?? 0,
      volume: muted ? 0 : (existing?.volume ?? 1),
      loop: existing?.loop ?? false,
      fadeIn: existing?.fadeIn ?? 0,
      fadeOut: existing?.fadeOut ?? 0,
    };
  });
}

function findClipById(
  clips: TimelineClip[],
  clipId: string,
): TimelineClip | undefined {
  return clips.find((clip) => clip.id === clipId);
}

/**
 * Flatten editor snapshot → MotionProject tuần tự.
 * Base gaps → pad scenes; overlay active → merge nodes vào segment.
 * Rejects invalid TimelineDocument when validation fails.
 */
export function buildExportProject(snapshot: EditorExportSnapshot): MotionProject {
  const { project, timelineClips, timelineLanes } = snapshot;
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

  const scenesById = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const boundaries = collectBoundaryTimes(timelineClips, timelineLanes);
  const contentEnd = timelineClips.reduce(
    (end, clip) => Math.max(end, clip.startTime + clip.duration),
    0,
  );
  if (boundaries.length === 0 || contentEnd <= 0) {
    const fallback =
      project.scenes[0] ?? emptyPadScene(uid("pad"), 0.5, "Empty");
    return parseMotionProject({
      ...project,
      scenes: [{ ...fallback, duration: Math.max(0.5, fallback.duration) }],
      timeline: {
        sceneOrder: [fallback.id],
        audioTracks: buildAudioTracks(project, timelineClips, timelineLanes),
      },
    });
  }

  const lastBoundary = boundaries[boundaries.length - 1] ?? 0;
  if (lastBoundary < contentEnd) {
    boundaries.push(contentEnd);
  }

  const bakedScenes: MotionScene[] = [];
  const sceneOrder: string[] = [];

  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const t0 = boundaries[i] ?? 0;
    const t1 = boundaries[i + 1] ?? t0;
    const duration = t1 - t0;
    if (duration <= 1e-6) continue;
    const mid = t0 + duration / 2;
    const layers = composeVisualLayersAtTime(timelineClips, timelineLanes, mid);
    const baseLayer = layers.find((layer) => layer.role === "base");
    const overlayLayers = layers.filter((layer) => layer.role === "overlay");

    let scene: MotionScene;
    if (baseLayer) {
      const source = scenesById.get(baseLayer.sceneId);
      const baseClip = findClipById(timelineClips, baseLayer.clipId);
      const localStart = baseClip
        ? clipLocalTime(baseClip.startTime, baseClip.duration, t0)
        : 0;
      scene = source
        ? sliceScene(source, localStart, duration)
        : emptyPadScene(uid("pad"), duration, "Missing base");
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
      scene = emptyPadScene(uid("bake"), duration, "Overlay gap");
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
      scene = emptyPadScene(uid("bake"), duration, "Gap");
    }

    bakedScenes.push(scene);
    sceneOrder.push(scene.id);
  }

  if (bakedScenes.length === 0) {
    const pad = emptyPadScene(uid("pad"), 0.5, "Empty");
    bakedScenes.push(pad);
    sceneOrder.push(pad.id);
  }

  return parseMotionProject({
    ...project,
    scenes: bakedScenes,
    timeline: {
      sceneOrder,
      audioTracks: buildAudioTracks(project, timelineClips, timelineLanes),
    },
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

/** Map global timeline time → baked scene + local time within that scene. */
export function resolveBakedLocalTime(
  baked: MotionProject,
  globalTime: number,
): { sceneId: string; localTime: number } | null {
  let cursor = 0;
  for (const sceneId of baked.timeline.sceneOrder) {
    const scene = baked.scenes.find((s) => s.id === sceneId);
    if (!scene) continue;
    const end = cursor + scene.duration;
    if (globalTime < end || Math.abs(globalTime - end) < 1e-9) {
      if (globalTime >= cursor || Math.abs(globalTime - cursor) < 1e-9) {
        return {
          sceneId,
          localTime: Math.max(0, Math.min(scene.duration - 1e-6, globalTime - cursor)),
        };
      }
    }
    if (globalTime >= cursor && globalTime < end) {
      return { sceneId, localTime: globalTime - cursor };
    }
    cursor = end;
  }
  return null;
}
