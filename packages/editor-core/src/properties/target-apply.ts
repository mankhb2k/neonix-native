/**
 * Target traversal/apply: áp một patch lên danh sách targets, hoặc gom logic
 * reorder / audio track ở mức project. Nhận/trả PropertyApplyResult.
 */
import type { MotionLayer, MotionProject } from "@motionvideo/motion-protocol";
import { mapNode } from "../timeline/internal/scene-utils";
import { findNode } from "./resolve-targets";
import type {
  DocumentPropertyCommand,
  NodeTargetRef,
} from "./property-commands";
import type { PropertyApplyResult } from "./property-runner-state";

export function applyToTargets(
  project: MotionProject,
  targets: NodeTargetRef[],
  transform: (node: MotionLayer) => MotionLayer,
): PropertyApplyResult {
  let next = project;
  for (const target of targets) {
    const scene = next.layers.find((s) => s.id === target.rootLayerId);
    const node = findNode(next, target.rootLayerId, target.layerId);
    if (!scene || !node) {
      return { project: next, missing: true };
    }
    next = mapNode(next, target.rootLayerId, target.layerId, transform);
  }
  return { project: next, missing: false };
}

/** Apply only when transform returns a node; reject if any target is incompatible. */
export function applyToCompatibleTargets(
  project: MotionProject,
  targets: NodeTargetRef[],
  transform: (node: MotionLayer) => MotionLayer | null,
): PropertyApplyResult {
  let next = project;
  for (const target of targets) {
    const scene = next.layers.find((s) => s.id === target.rootLayerId);
    const node = findNode(next, target.rootLayerId, target.layerId);
    if (!scene || !node) {
      return { project: next, missing: true, incompatible: false };
    }
    const updated = transform(node);
    if (!updated) {
      return { project: next, missing: false, incompatible: true };
    }
    next = mapNode(next, target.rootLayerId, target.layerId, () => updated);
  }
  return { project: next, missing: false, incompatible: false };
}

export function applyAudioTrack(
  project: MotionProject,
  audioTrackId: string,
  command: Extract<DocumentPropertyCommand, { type: "set-audio-track" }>,
): PropertyApplyResult {
  const idx = project.layers.findIndex(
    (l) => l.type === "audio" && l.id === audioTrackId,
  );
  if (idx < 0) return { project, missing: true };
  const track = project.layers[idx]!;
  if (track.type !== "audio") return { project, missing: true };
  const nextTrack: MotionLayer = {
    ...track,
    payload: {
      ...track.payload,
      volume:
        command.patch.volume !== undefined
          ? Math.min(100, Math.max(0, Math.round(command.patch.volume * 100)))
          : track.payload.volume,
      fadeIn:
        command.patch.fadeIn !== undefined
          ? Math.max(0, command.patch.fadeIn)
          : track.payload.fadeIn,
      fadeOut:
        command.patch.fadeOut !== undefined
          ? Math.max(0, command.patch.fadeOut)
          : track.payload.fadeOut,
    },
  };
  const layers = project.layers.slice();
  layers[idx] = nextTrack;
  return {
    project: { ...project, layers },
    missing: false,
  };
}

export function applyReorderSceneNodes(
  project: MotionProject,
  sceneId: string,
  layerIds: string[],
): PropertyApplyResult {
  const scene = project.layers.find(
    (l) => l.id === sceneId && l.type !== "audio",
  );
  if (!scene || scene.type !== "group") return { project, missing: true };

  const byId = new Map(scene.children.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const ordered: MotionLayer[] = [];
  for (const id of layerIds) {
    if (!id || seen.has(id)) continue;
    const node = byId.get(id);
    if (!node) return { project, missing: true };
    seen.add(id);
    ordered.push(node);
  }
  for (const node of scene.children) {
    if (!seen.has(node.id)) ordered.push(node);
  }

  const count = ordered.length;
  const withZ = ordered.map((node, index) => ({
    ...node,
    zIndex: count - 1 - index,
  }));

  return {
    project: {
      ...project,
      layers: project.layers.map((l) =>
        l.id === sceneId ? { ...scene, children: withZ } : l,
      ),
    },
    missing: false,
  };
}
