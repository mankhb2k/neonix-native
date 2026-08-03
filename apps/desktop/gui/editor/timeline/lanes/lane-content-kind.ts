/**
 * Infer overlay lane content kind from scene clips (view-model index).
 */

import type { TimelineClip, TimelineLane } from "@motionvideo/editor-core";
import type { MotionProject, Scene } from "@motionvideo/motion-schema";

export type LaneContentKind = "video" | "text" | "component" | "audio";

function collectNodeKinds(
  scene: Scene,
  kinds: Set<Exclude<LaneContentKind, "audio">>,
): void {
  for (const node of scene.nodes) {
    if (node.type === "text") kinds.add("text");
    else if (
      node.type === "shape" ||
      node.type === "path" ||
      node.type === "component"
    ) {
      kinds.add("component");
    } else if (
      node.type === "video" ||
      node.type === "image" ||
      node.type === "svg"
    ) {
      kinds.add("video");
    }
  }
}

function kindFromSceneIds(
  sceneIds: ReadonlyArray<string>,
  sceneById: ReadonlyMap<string, Scene>,
): LaneContentKind {
  if (sceneIds.length === 0 || sceneById.size === 0) return "component";

  const kinds = new Set<Exclude<LaneContentKind, "audio">>();
  for (const sceneId of sceneIds) {
    const scene = sceneById.get(sceneId);
    if (!scene) continue;
    collectNodeKinds(scene, kinds);
  }

  if (kinds.size === 1) {
    const only = kinds.values().next().value;
    if (only) return only;
  }
  return "component";
}

/** Build scene id → scene once per project snapshot. */
export function buildSceneById(
  project: MotionProject | null | undefined,
): Map<string, Scene> {
  const sceneById = new Map<string, Scene>();
  if (!project) return sceneById;
  for (const scene of project.scenes) {
    sceneById.set(scene.id, scene);
  }
  return sceneById;
}

/**
 * Precompute lane → content kind when clips/project change.
 * One pass over clips + O(1) scene lookup; render path only Map.gets.
 */
export function buildLaneContentKindById(
  lanes: ReadonlyArray<TimelineLane>,
  clips: ReadonlyArray<TimelineClip>,
  project: MotionProject | null | undefined,
): Map<string, LaneContentKind> {
  const sceneById = buildSceneById(project);
  const sceneIdsByLaneId = new Map<string, string[]>();

  for (const clip of clips) {
    if (clip.kind !== "scene" || !clip.laneId) continue;
    const list = sceneIdsByLaneId.get(clip.laneId);
    if (list) list.push(clip.sceneId);
    else sceneIdsByLaneId.set(clip.laneId, [clip.sceneId]);
  }

  const out = new Map<string, LaneContentKind>();
  for (const lane of lanes) {
    if (lane.kind === "audio") {
      out.set(lane.id, "audio");
      continue;
    }
    if (lane.role === "base") {
      out.set(lane.id, "video");
      continue;
    }
    out.set(
      lane.id,
      kindFromSceneIds(sceneIdsByLaneId.get(lane.id) ?? [], sceneById),
    );
  }
  return out;
}
