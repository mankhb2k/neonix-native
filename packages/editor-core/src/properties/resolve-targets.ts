import {
  focusedNodeIdFrom,
  selectedSceneIdFrom,
  type EditorSelection,
} from "../selection/editor-selection";
import type {
  TimelineClip,
  TimelineLane,
} from "../timeline/model/timeline-types";
import type { MotionLayer, MotionProject } from "@motionvideo/motion-protocol";
import type { NodeTarget } from "./types";

function firstEditableNodeId(scene: MotionLayer | undefined): string | null {
  if (!scene) return null;
  // Group root → child đầu tiên là node edit được (Layer Mode).
  if (scene.type === "group") {
    return scene.children[0]?.id ?? null;
  }
  // Primitive root (text/shape/image/...) → chính nó là node edit được.
  // Protocol canonical cho phép root layer không phải group (đã unwrap).
  return scene.id;
}

/**
 * Resolve node targets for property edits from selection.
 * - node selection → that node
 * - clip selection → focused/first editable node per selected scene clip
 */
export function resolvePropertyTargets(
  selection: EditorSelection,
  project: MotionProject | null,
  clips: TimelineClip[],
  lanes: TimelineLane[],
): NodeTarget[] {
  if (!project) return [];

  if (selection.kind === "node") {
    return [
      {
        rootLayerId:
          rootLayerIdOf(project, selection.layerId) ?? selection.layerId,
        layerId: selection.layerId,
      },
    ];
  }

  if (selection.kind !== "clips") return [];

  const targets: NodeTarget[] = [];
  const seen = new Set<string>();

  for (const clipId of selection.ids) {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip || clip.kind !== "scene") continue;
    const sceneId = clip.sceneId;
    if (!sceneId) continue;
    const scene = project.layers.find((s) => s.id === sceneId);
    const layerId =
      selection.primaryId === clipId
        ? focusedNodeIdFrom(
            selection,
            clips,
            lanes,
            project,
            firstEditableNodeId,
          )
        : firstEditableNodeId(scene);
    if (!layerId) continue;
    const key = `${sceneId}::${layerId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ rootLayerId: sceneId, layerId });
  }

  // Fallback: primary scene focused node when ids empty of scene clips
  if (targets.length === 0) {
    const sceneId = selectedSceneIdFrom(selection, clips, lanes);
    const layerId = focusedNodeIdFrom(
      selection,
      clips,
      lanes,
      project,
      firstEditableNodeId,
    );
    if (sceneId && layerId) targets.push({ rootLayerId: sceneId, layerId });
  }

  return targets;
}

export function findNode(
  project: MotionProject,
  _rootLayerId: string,
  layerId: string,
): MotionLayer | null {
  const walk = (nodes: MotionLayer[]): MotionLayer | null => {
    for (const node of nodes) {
      if (node.id === layerId) return node;
      if (node.type === "group") {
        const found = walk(node.children);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(project.layers);
}

/**
 * Root ("scene") layer id for a layerId — walks to the top-level ancestor.
 * Root layers return their own id; nested nodes return the root group id.
 * Layer ids are globally unique, so layerId alone fully identifies a node.
 */
export function rootLayerIdOf(
  project: MotionProject | null,
  layerId: string,
): string | null {
  if (!project) return null;
  const walk = (nodes: MotionLayer[], rootId: string | null): string | null => {
    for (const node of nodes) {
      if (node.id === layerId) return rootId ?? node.id;
      if (node.type === "group") {
        const found = walk(node.children, rootId ?? node.id);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(project.layers, null);
}
