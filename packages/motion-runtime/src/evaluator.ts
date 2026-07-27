import { motionPropertyCapability, type NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";
import {
  IDENTITY_MATRIX,
  applyMatrix,
  decomposeMatrix,
  inheritedParentMatrix,
  localTransformMatrix,
  multiplyMatrix,
  type Matrix2D,
  type Transform2D,
} from "./matrix";
import { invertMatrix, transformBounds, type Bounds2D } from "./spatial";
import {
  bendPathContours,
  localNodeBounds,
  pathMorphContours,
  samplePathContour,
  trimPathContours,
} from "./geometry";
import { solveSecondaryMotionChain } from "./secondary-motion";

export type RuntimeScene = NormalizedMotionProjectV2["scenes"][number];
export type RuntimeNode = RuntimeScene["nodes"][number];
export type RuntimeTrack = RuntimeScene["tracks"][number];
export type RuntimeEffect = NonNullable<RuntimeNode["effects"]>[number];

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

function effectNumber(
  scene: RuntimeScene,
  node: RuntimeNode,
  effect: RuntimeEffect,
  field: string,
  time: number,
  fallback: number,
): number {
  const value = evaluateProperty(scene, node, `effects.${effect.id}.${field}`, time, fallback);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function effectString(
  scene: RuntimeScene,
  node: RuntimeNode,
  effect: RuntimeEffect,
  field: string,
  time: number,
  fallback: string,
): string {
  const value = evaluateProperty(scene, node, `effects.${effect.id}.${field}`, time, fallback);
  return typeof value === "string" ? value : fallback;
}

/** Resolve one ordered effect at a deterministic frame timestamp. */
export function evaluateEffect(
  scene: RuntimeScene,
  node: RuntimeNode,
  effect: RuntimeEffect,
  time: number,
): RuntimeEffect {
  switch (effect.type) {
    case "blur":
      return { ...effect, radius: effectNumber(scene, node, effect, "radius", time, effect.radius) };
    case "shadow":
      return {
        ...effect,
        offsetX: effectNumber(scene, node, effect, "offsetX", time, effect.offsetX),
        offsetY: effectNumber(scene, node, effect, "offsetY", time, effect.offsetY),
        blur: effectNumber(scene, node, effect, "blur", time, effect.blur),
        color: effectString(scene, node, effect, "color", time, effect.color),
        opacity: effectNumber(scene, node, effect, "opacity", time, effect.opacity),
      };
    case "glow":
      return {
        ...effect,
        radius: effectNumber(scene, node, effect, "radius", time, effect.radius),
        intensity: effectNumber(scene, node, effect, "intensity", time, effect.intensity),
        color: effectString(scene, node, effect, "color", time, effect.color),
        opacity: effectNumber(scene, node, effect, "opacity", time, effect.opacity),
      };
    case "color-adjust":
      return {
        ...effect,
        brightness: effectNumber(scene, node, effect, "brightness", time, effect.brightness),
        contrast: effectNumber(scene, node, effect, "contrast", time, effect.contrast),
        saturation: effectNumber(scene, node, effect, "saturation", time, effect.saturation),
      };
  }
}

/** Resolve effects in authoring order; consumers must preserve this order. */
export function evaluateNodeEffects(scene: RuntimeScene, node: RuntimeNode, time: number): RuntimeEffect[] {
  return (node.effects ?? []).map((effect) => evaluateEffect(scene, node, effect, time));
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

function topologicalNodes(scene: RuntimeScene): RuntimeNode[] {
  const byId = new Map(scene.nodes.map((node) => [node.id, node]));
  const declarationIndex = new Map(scene.nodes.map((node, index) => [node.id, index]));
  const outgoing = new Map(scene.nodes.map((node) => [node.id, new Set<string>()]));
  const indegree = new Map(scene.nodes.map((node) => [node.id, 0]));
  const addEdge = (from: string | null | undefined, to: string) => {
    if (!from || !byId.has(from) || outgoing.get(from)!.has(to)) return;
    outgoing.get(from)!.add(to);
    indegree.set(to, indegree.get(to)! + 1);
  };
  for (const node of scene.nodes) {
    addEdge(node.parentId, node.id);
    for (const modifier of node.modifiers ?? []) {
      if (modifier.type === "constraint") addEdge(modifier.targetNodeId, node.id);
    }
  }
  const ready = scene.nodes.filter((node) => indegree.get(node.id) === 0);
  const ordered: RuntimeNode[] = [];
  while (ready.length > 0) {
    ready.sort((left, right) => declarationIndex.get(left.id)! - declarationIndex.get(right.id)!);
    const node = ready.shift()!;
    ordered.push(node);
    for (const targetId of outgoing.get(node.id)!) {
      indegree.set(targetId, indegree.get(targetId)! - 1);
      if (indegree.get(targetId) === 0) ready.push(byId.get(targetId)!);
    }
  }
  return ordered.length === scene.nodes.length ? ordered : scene.nodes;
}

function blendAngle(from: number, to: number, weight: number): number {
  const delta = ((to - from + 180) % 360 + 360) % 360 - 180;
  return from + delta * weight;
}

export function evaluateScene(scene: RuntimeScene, time: number): EvaluatedNode[] {
  const byId = new Map(scene.nodes.map((node) => [node.id, node]));
  const secondaryRotations = new Map<string, number>();
  for (const node of scene.nodes) {
    for (const modifier of node.modifiers ?? []) {
      if (modifier.type !== "secondary-motion" || modifier.axis !== "rotation") continue;
      const driver = byId.get(modifier.driverNodeId);
      if (!driver) throw new Error(`Runtime Secondary Motion driver missing: ${modifier.driverNodeId}`);
      const rotations = solveSecondaryMotionChain(time, {
        chainLength: modifier.chainNodeIds.length,
        stiffness: modifier.stiffness,
        damping: modifier.damping,
        lag: modifier.lag,
        amplitude: modifier.amplitude,
      }, (sampleTime) => evaluateTransform(scene, driver, sampleTime).rotation);
      for (let index = 0; index < modifier.chainNodeIds.length; index += 1) {
        const chainNodeId = modifier.chainNodeIds[index]!;
        secondaryRotations.set(chainNodeId, (secondaryRotations.get(chainNodeId) ?? 0) + rotations[index]!);
      }
    }
  }
  const evaluated = new Map<string, EvaluatedNode>();
  const visiting = new Set<string>();

  const evaluate = (node: RuntimeNode): EvaluatedNode => {
    const cached = evaluated.get(node.id);
    if (cached) return cached;
    if (visiting.has(node.id)) throw new Error(`Runtime parent cycle: ${node.id}`);
    visiting.add(node.id);

    let transform = evaluateTransform(scene, node, time);
    const secondaryRotation = secondaryRotations.get(node.id);
    if (secondaryRotation !== undefined) transform = { ...transform, rotation: transform.rotation + secondaryRotation };
    let parentMatrix = IDENTITY_MATRIX;
    let worldOpacity = transform.opacity;
    let visible = transform.visible;
    if (node.parentId) {
      const parentNode = byId.get(node.parentId);
      if (!parentNode) throw new Error(`Runtime parent missing: ${node.parentId}`);
      const parent = evaluate(parentNode);
      parentMatrix = inheritedParentMatrix(parent.worldMatrix, {
        position: node.inheritPosition !== false,
        rotation: node.inheritRotation !== false,
        scale: node.inheritScale !== false,
      });
      worldOpacity = (node.inheritOpacity !== false ? parent.worldOpacity : 1) * transform.opacity;
      visible = parent.visible && transform.visible;
    }

    const motionPath = node.modifiers?.find((modifier) => modifier.type === "motion-path");
    if (motionPath) {
      const pathNode = byId.get(motionPath.pathNodeId);
      if (!pathNode || pathNode.type !== "path") throw new Error(`Runtime Motion Path source missing: ${motionPath.pathNodeId}`);
      const path = evaluate(pathNode);
      const rawProgress = evaluateProperty(scene, node, `modifiers.${motionPath.id}.progress`, time, motionPath.progress);
      const progress = typeof rawProgress === "number" ? rawProgress : motionPath.progress;
      const mappedProgress = motionPath.startOffset + (motionPath.endOffset - motionPath.startOffset) * progress;
      const sourceMorph = pathNode.modifiers?.find((modifier) => modifier.type === "path-morph");
      const sourceProgress = sourceMorph
        ? evaluateProperty(scene, pathNode, `modifiers.${sourceMorph.id}.progress`, time, sourceMorph.progress)
        : undefined;
      const sourceContours = sourceMorph
        ? pathMorphContours(pathNode, typeof sourceProgress === "number" ? sourceProgress : 0)
        : pathNode.payload.contours;
      const sample = samplePathContour(pathNode, motionPath.contourId, mappedProgress, sourceContours);
      const worldPoint = applyMatrix(path.worldMatrix, sample.point.x, sample.point.y);
      const worldTangentPoint = applyMatrix(path.worldMatrix, sample.point.x + sample.tangent.x, sample.point.y + sample.tangent.y);
      const inverseParent = invertMatrix(parentMatrix);
      if (!inverseParent) throw new Error(`Motion Path target parent matrix is not invertible: ${node.id}`);
      const localPoint = applyMatrix(inverseParent, worldPoint.x, worldPoint.y);
      const localTangentPoint = applyMatrix(inverseParent, worldTangentPoint.x, worldTangentPoint.y);
      transform = {
        ...transform,
        x: localPoint.x,
        y: localPoint.y,
        rotation: motionPath.orientToPath
          ? Math.atan2(localTangentPoint.y - localPoint.y, localTangentPoint.x - localPoint.x) * 180 / Math.PI + motionPath.rotationOffset
          : transform.rotation,
      };
    }

    const constraint = node.modifiers?.find((modifier) => modifier.type === "constraint");
    if (constraint) {
      const targetNode = byId.get(constraint.targetNodeId);
      if (!targetNode) throw new Error(`Runtime Constraint target missing: ${constraint.targetNodeId}`);
      const target = evaluated.get(targetNode.id) ?? evaluate(targetNode);
      const rawWeight = evaluateProperty(scene, node, `modifiers.${constraint.id}.weight`, time, constraint.weight);
      const weight = Math.min(1, Math.max(0, typeof rawWeight === "number" ? rawWeight : constraint.weight));
      const targetWorld = decomposeMatrix(target.worldMatrix);
      const parentWorld = decomposeMatrix(parentMatrix);
      if (constraint.kind === "copy-position") {
        const inverseParent = invertMatrix(parentMatrix);
        if (!inverseParent) throw new Error(`Constraint target parent matrix is not invertible: ${node.id}`);
        const localTarget = applyMatrix(inverseParent, targetWorld.x, targetWorld.y);
        transform = {
          ...transform,
          x: transform.x + (localTarget.x - transform.x) * weight,
          y: transform.y + (localTarget.y - transform.y) * weight,
        };
      } else if (constraint.kind === "copy-rotation") {
        transform = {
          ...transform,
          rotation: blendAngle(transform.rotation, targetWorld.rotation - parentWorld.rotation, weight),
        };
      } else {
        const baseWorld = multiplyMatrix(parentMatrix, localTransformMatrix(transform));
        const worldAngle = Math.atan2(targetWorld.y - baseWorld.f, targetWorld.x - baseWorld.e) * 180 / Math.PI;
        transform = {
          ...transform,
          rotation: blendAngle(transform.rotation, worldAngle - parentWorld.rotation, weight),
        };
      }
    }

    const worldMatrix = multiplyMatrix(parentMatrix, localTransformMatrix(transform));
    let paintContours = node.type === "path" ? node.payload.contours : undefined;
    if (node.type === "path") {
      const pathMorph = node.modifiers?.find((modifier) => modifier.type === "path-morph");
      if (pathMorph) {
        const progress = evaluateProperty(scene, node, `modifiers.${pathMorph.id}.progress`, time, pathMorph.progress);
        paintContours = pathMorphContours(
          node,
          typeof progress === "number" ? progress : typeof pathMorph.progress === "number" ? pathMorph.progress : 0,
        );
      }
      const bend = node.modifiers?.find((modifier) => modifier.type === "path-bend");
      if (bend) {
        const amount = evaluateProperty(scene, node, `modifiers.${bend.id}.amount`, time, bend.amount);
        paintContours = bendPathContours(paintContours ?? node.payload.contours, typeof amount === "number" ? amount : bend.amount);
      }
      const trim = node.modifiers?.find((modifier) => modifier.type === "trim-path");
      if (trim) {
        const start = evaluateProperty(scene, node, `modifiers.${trim.id}.start`, time, trim.start);
        const end = evaluateProperty(scene, node, `modifiers.${trim.id}.end`, time, trim.end);
        const offset = evaluateProperty(scene, node, `modifiers.${trim.id}.offset`, time, trim.offset);
        paintContours = trimPathContours(
          paintContours ?? node.payload.contours,
          typeof start === "number" ? start : trim.start,
          typeof end === "number" ? end : trim.end,
          typeof offset === "number" ? offset : trim.offset,
        );
      }
    }

    const strokeWidth = (node.type === "shape" || node.type === "path") && node.style?.stroke
      ? numberProperty(scene, node, "style.strokeWidth", time, node.style.strokeWidth ?? 1)
      : 0;
    const worldBounds = transformBounds(worldMatrix, localNodeBounds(node, transform, strokeWidth, paintContours));
    const result = { node, transform, worldMatrix, worldOpacity, visible, worldBounds };
    evaluated.set(node.id, result);
    visiting.delete(node.id);
    return result;
  };

  for (const node of topologicalNodes(scene)) evaluate(node);
  return scene.nodes.map((node) => evaluated.get(node.id) ?? evaluate(node));
}

export { IDENTITY_MATRIX };
