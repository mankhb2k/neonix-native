import {
  focusedNodeIdFrom,
  selectedSceneIdFrom,
  type EditorSelection,
} from "../selection/editor-selection";
import type { TimelineClip, TimelineLane } from "../timeline/model/timeline-types";
import type { MotionLayer, MotionProject } from "@motionvideo/motion-protocol";
import type { NodeTarget } from "./types";

function firstEditableNodeId(
  scene: { children?: MotionLayer[] } | undefined,
): string | null {
  return scene?.children?.[0]?.id ?? null;
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
    return [{ sceneId: selection.sceneId, layerId: selection.layerId }];
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
    if (!nodeId) continue;
    const key = `${sceneId}::${layerId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ sceneId, layerId });
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
    if (sceneId && nodeId) targets.push({ sceneId, layerId });
  }

  return targets;
}

export function findNode(
  project: MotionProject,
  _sceneId: string,
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
