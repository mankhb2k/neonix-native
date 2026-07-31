import {
  focusedNodeIdFrom,
  selectedSceneIdFrom,
  type EditorSelection,
} from "../selection/editor-selection";
import type { TimelineClip, TimelineLane } from "../timeline/model/timeline-types";
import type { MotionProject } from "@motionvideo/motion-schema";
import type { NodeTarget } from "./types";

function firstEditableNodeId(
  scene: MotionProject["scenes"][number] | undefined,
): string | null {
  if (!scene?.nodes.length) return null;
  return scene.nodes[0]?.id ?? null;
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
    return [{ sceneId: selection.sceneId, nodeId: selection.nodeId }];
  }

  if (selection.kind !== "clips") return [];

  const targets: NodeTarget[] = [];
  const seen = new Set<string>();

  for (const clipId of selection.ids) {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip || clip.kind !== "scene") continue;
    const sceneId = clip.sceneId;
    if (!sceneId) continue;
    const scene = project.scenes.find((s) => s.id === sceneId);
    const nodeId =
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
    const key = `${sceneId}::${nodeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ sceneId, nodeId });
  }

  // Fallback: primary scene focused node when ids empty of scene clips
  if (targets.length === 0) {
    const sceneId = selectedSceneIdFrom(selection, clips, lanes);
    const nodeId = focusedNodeIdFrom(
      selection,
      clips,
      lanes,
      project,
      firstEditableNodeId,
    );
    if (sceneId && nodeId) targets.push({ sceneId, nodeId });
  }

  return targets;
}

export function findNode(
  project: MotionProject,
  sceneId: string,
  nodeId: string,
): MotionProject["scenes"][number]["nodes"][number] | null {
  const scene = project.scenes.find((s) => s.id === sceneId);
  return scene?.nodes.find((n) => n.id === nodeId) ?? null;
}
