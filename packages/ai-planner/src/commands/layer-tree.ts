import { type MotionLayer, type MotionProject } from "@motionvideo/motion-protocol";

export const AI_EXT_KEY = "com.moticlip.ai";

export type AiPlannerExt = {
  activeCameraLayerId?: string;
  space?: "flat-2d" | "layered-2.5d";
};

export type GroupLayer = Extract<MotionLayer, { type: "group" }>;

function flatten(layers: MotionLayer[]): MotionLayer[] {
  const out: MotionLayer[] = [];
  const walk = (nodes: MotionLayer[]): void => {
    for (const node of nodes) {
      out.push(node);
      if (node.type === "group") walk(node.children);
    }
  };
  walk(layers);
  return out;
}

export function getAiExt(project: MotionProject): AiPlannerExt {
  const raw = project.extensions[AI_EXT_KEY];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rec = raw as AiPlannerExt;
    return {
      activeCameraLayerId: rec.activeCameraLayerId,
      space: rec.space,
    };
  }
  return {};
}

export function setAiExt(project: MotionProject, ext: AiPlannerExt): void {
  project.extensions = { ...project.extensions, [AI_EXT_KEY]: ext };
}

export function sceneGroups(project: MotionProject): GroupLayer[] {
  return project.layers.filter((layer): layer is GroupLayer => layer.type === "group");
}

export function findSceneGroup(
  project: MotionProject,
  sceneId: string,
): GroupLayer | undefined {
  return sceneGroups(project).find((layer) => layer.id === sceneId);
}

export function sceneLayers(scene: GroupLayer): MotionLayer[] {
  return flatten(scene.children);
}

export function findLayer(
  project: MotionProject,
  layerId: string,
): MotionLayer | undefined {
  return flatten(project.layers).find((layer) => layer.id === layerId);
}

export function insertLayer(scene: GroupLayer, node: MotionLayer): void {
  const parentId = node.parentLayerId ?? scene.id;
  node.parentLayerId = parentId;
  if (parentId === scene.id) {
    scene.children.push(node);
    return;
  }
  const parent = flatten(scene.children).find((layer) => layer.id === parentId);
  if (parent && parent.type === "group") {
    parent.children.push(node);
    return;
  }
  node.parentLayerId = scene.id;
  scene.children.push(node);
}

export function removeLayers(scene: GroupLayer, ids: Set<string>): void {
  const filter = (nodes: MotionLayer[]): MotionLayer[] =>
    nodes
      .filter((node) => !ids.has(node.id))
      .map((node) =>
        node.type === "group" ? { ...node, children: filter(node.children) } : node,
      );
  scene.children = filter(scene.children);
}

export function refreshTimelineDuration(project: MotionProject): void {
  const duration = sceneGroups(project).reduce(
    (sum, scene) => sum + (scene.timing?.duration ?? 0),
    0,
  );
  project.timeline = { ...project.timeline, duration };
}
