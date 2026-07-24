import { motionPropertyCapability, type NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";
import {
  IDENTITY_MATRIX,
  inheritedParentMatrix,
  localTransformMatrix,
  multiplyMatrix,
  type Matrix2D,
  type Transform2D,
} from "./matrix";
import { transformBounds, type Bounds2D } from "./spatial";

export type RuntimeScene = NormalizedMotionProjectV2["scenes"][number];
export type RuntimeNode = RuntimeScene["nodes"][number];
export type RuntimeTrack = RuntimeScene["tracks"][number];

export type EvaluatedNode = {
  node: RuntimeNode;
  transform: Transform2D;
  worldMatrix: Matrix2D;
  worldOpacity: number;
  visible: boolean;
  worldBounds: Bounds2D;
};

export function easingValue(progress: number, easing = "linear"): number {
  const value = Math.min(1, Math.max(0, progress));
  switch (easing) {
    case "step": return value < 1 ? 0 : 1;
    case "easeIn": return value * value;
    case "easeInOut": return value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2;
    case "spring": return Math.min(1.08, 1 - Math.cos(value * Math.PI * 2.5) * Math.exp(-5 * value));
    case "easeOut": return 1 - (1 - value) ** 3;
    default: return value;
  }
}

export function evaluateTrack(track: RuntimeTrack | undefined, time: number, fallback: unknown): unknown {
  if (!track || track.keys.length === 0) return fallback;
  const keys = track.keys;
  if (time <= keys[0]!.t) return keys[0]!.v;
  const last = keys[keys.length - 1]!;
  if (time >= last.t) return last.v;
  for (let index = 1; index < keys.length; index += 1) {
    const right = keys[index]!;
    const left = keys[index - 1]!;
    if (time > right.t) continue;
    if (typeof left.v !== "number" || typeof right.v !== "number") return time < right.t ? left.v : right.v;
    const progress = easingValue((time - left.t) / Math.max(0.000001, right.t - left.t), right.easing);
    return left.v + (right.v - left.v) * progress;
  }
  return fallback;
}

export function evaluateProperty(
  scene: RuntimeScene,
  node: RuntimeNode,
  property: string,
  time: number,
  fallback: unknown,
): unknown {
  const value = evaluateTrack(
    scene.tracks.find((track) => track.targetId === node.id && track.property === property),
    time,
    fallback,
  );
  const capability = motionPropertyCapability(node.type, property);
  if (typeof value !== "number" || !capability) return value;
  let bounded = value;
  if (capability.min !== undefined) bounded = Math.max(capability.min, bounded);
  if (capability.minExclusive !== undefined && bounded <= capability.minExclusive) bounded = capability.minExclusive + Number.EPSILON;
  if (capability.max !== undefined) bounded = Math.min(capability.max, bounded);
  return bounded;
}

function numberProperty(scene: RuntimeScene, node: RuntimeNode, property: string, time: number, fallback: number): number {
  const value = evaluateProperty(scene, node, property, time, fallback);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanProperty(scene: RuntimeScene, node: RuntimeNode, property: string, time: number, fallback: boolean): boolean {
  const value = evaluateProperty(scene, node, property, time, fallback);
  return typeof value === "boolean" ? value : fallback;
}

export function evaluateTransform(scene: RuntimeScene, node: RuntimeNode, time: number): Transform2D {
  return {
    x: numberProperty(scene, node, "transform.x", time, node.transform.x),
    y: numberProperty(scene, node, "transform.y", time, node.transform.y),
    width: numberProperty(scene, node, "transform.width", time, node.transform.width),
    height: numberProperty(scene, node, "transform.height", time, node.transform.height),
    rotation: numberProperty(scene, node, "transform.rotation", time, node.transform.rotation),
    scaleX: numberProperty(scene, node, "transform.scaleX", time, node.transform.scaleX),
    scaleY: numberProperty(scene, node, "transform.scaleY", time, node.transform.scaleY),
    anchorX: numberProperty(scene, node, "transform.anchorX", time, node.transform.anchorX),
    anchorY: numberProperty(scene, node, "transform.anchorY", time, node.transform.anchorY),
    opacity: numberProperty(scene, node, "transform.opacity", time, node.transform.opacity),
    visible: booleanProperty(scene, node, "transform.visible", time, node.transform.visible),
    flipX: booleanProperty(scene, node, "transform.flipX", time, node.transform.flipX),
    flipY: booleanProperty(scene, node, "transform.flipY", time, node.transform.flipY),
  };
}

export function evaluateScene(scene: RuntimeScene, time: number): EvaluatedNode[] {
  const byId = new Map(scene.nodes.map((node) => [node.id, node]));
  const evaluated = new Map<string, EvaluatedNode>();
  const visiting = new Set<string>();

  const evaluate = (node: RuntimeNode): EvaluatedNode => {
    const cached = evaluated.get(node.id);
    if (cached) return cached;
    if (visiting.has(node.id)) throw new Error(`Runtime parent cycle: ${node.id}`);
    visiting.add(node.id);

    const transform = evaluateTransform(scene, node, time);
    let worldMatrix = localTransformMatrix(transform);
    let worldOpacity = transform.opacity;
    let visible = transform.visible;
    if (node.parentId) {
      const parentNode = byId.get(node.parentId);
      if (!parentNode) throw new Error(`Runtime parent missing: ${node.parentId}`);
      const parent = evaluate(parentNode);
      const parentMatrix = inheritedParentMatrix(parent.worldMatrix, {
        position: node.inheritPosition !== false,
        rotation: node.inheritRotation !== false,
        scale: node.inheritScale !== false,
      });
      worldMatrix = multiplyMatrix(parentMatrix, worldMatrix);
      worldOpacity = (node.inheritOpacity !== false ? parent.worldOpacity : 1) * transform.opacity;
      visible = parent.visible && transform.visible;
    }

    const worldBounds = transformBounds(worldMatrix, { x: 0, y: 0, width: transform.width, height: transform.height });
    const result = { node, transform, worldMatrix, worldOpacity, visible, worldBounds };
    evaluated.set(node.id, result);
    visiting.delete(node.id);
    return result;
  };

  return scene.nodes.map(evaluate);
}

export { IDENTITY_MATRIX };
