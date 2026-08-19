/**
 * Keyframe authoring subsystem — mini-domain riêng. allocate id, upsert/move/
 * delete/ease keyframes trên `layer.animations[]`.
 */
import {
  MOTION_PROTOCOL_LIMITS,
  V1,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import { findNode } from "./resolve-targets";
import type {
  DocumentPropertyCommand,
  NodeTargetRef,
} from "./property-commands";
import type { PropertyApplyResult } from "./property-runner-state";
import type { MotionLayer } from "@motionvideo/motion-protocol";

function normalizeAnimationProperty(property: string): string {
  if (property === "appearance.opacity") return "opacity";
  return property;
}

function findAnimationClipIndex(
  animations: readonly V1.LayerPropertyAnimationV1[],
  property: string,
): number {
  const normalized = normalizeAnimationProperty(property);
  return animations.findIndex(
    (clip) =>
      clip.property === normalized ||
      (normalized === "opacity" && clip.property === "appearance.opacity"),
  );
}

export function clampKeyframeTime(keyTime: number): number {
  return Math.min(
    MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    Math.max(0, keyTime),
  );
}

function patchLayerInTree(
  layers: MotionLayer[],
  layerId: string,
  update: (layer: MotionLayer) => MotionLayer,
): MotionLayer[] {
  return layers.map((layer) => {
    if (layer.id === layerId) return update(layer);
    if (layer.type === "group") {
      return { ...layer, children: patchLayerInTree(layer.children, layerId, update) };
    }
    return layer;
  });
}

function withLayerAnimations(
  project: MotionProject,
  layerId: string,
  animations: V1.LayerPropertyAnimationV1[],
): MotionProject {
  return {
    ...project,
    layers: patchLayerInTree(project.layers, layerId, (layer) => {
      if (layer.type === "audio") return layer;
      if (animations.length === 0) {
        const { animations: _omitted, ...rest } = layer as MotionLayer & {
          animations?: V1.LayerPropertyAnimationV1[];
        };
        return rest as MotionLayer;
      }
      return { ...layer, animations } as MotionLayer;
    }),
  };
}

function upsertKeyframeOnScene(
  project: MotionProject,
  target: NodeTargetRef,
  command: Extract<DocumentPropertyCommand, { type: "set-property-keyframe" }>,
): PropertyApplyResult {
  const node = findNode(project, target.rootLayerId, target.layerId);
  if (!node || node.type === "audio") return { project, missing: true };

  const t = clampKeyframeTime(command.t);
  const property = normalizeAnimationProperty(command.property);
  const layerDuration = node.timing?.duration;
  const keyT =
    typeof layerDuration === "number"
      ? Math.min(t, Math.max(0, layerDuration - 1e-6))
      : t;
  const animations = [...V1.getLayerAnimations(node)];
  const clipIdx = findAnimationClipIndex(animations, property);
  const key = {
    t: keyT,
    value: command.v,
    easing: command.easing,
  };
  if (clipIdx < 0) {
    animations.push({
      property,
      keys: [key],
    });
  } else {
    const clip = animations[clipIdx]!;
    const keys = [...clip.keys];
    const keyIdx = keys.findIndex((k) => Math.abs(k.t - keyT) < 1e-6);
    if (keyIdx >= 0) keys[keyIdx] = key;
    else {
      if (keys.length >= MOTION_PROTOCOL_LIMITS.keysPerPropertyAnimation) {
        return {
          project,
          missing: false,
          invalid: `Keyframe animation exceeds keysPerPropertyAnimation (${MOTION_PROTOCOL_LIMITS.keysPerPropertyAnimation}).`,
        };
      }
      keys.push(key);
      keys.sort((a, b) => a.t - b.t);
    }
    animations[clipIdx] = { ...clip, keys };
  }

  return {
    project: withLayerAnimations(project, target.layerId, animations),
    missing: false,
  };
}

function moveKeyframeOnScene(
  project: MotionProject,
  target: NodeTargetRef,
  command: Extract<DocumentPropertyCommand, { type: "move-property-keyframe" }>,
): PropertyApplyResult {
  const node = findNode(project, target.rootLayerId, target.layerId);
  if (!node || node.type === "audio") return { project, missing: false };
  const property = normalizeAnimationProperty(command.property);
  const animations = [...V1.getLayerAnimations(node)];
  const clipIdx = findAnimationClipIndex(animations, property);
  if (clipIdx < 0) return { project, missing: false };
  const clip = animations[clipIdx]!;
  const newT = clampKeyframeTime(command.newT);
  const collides = clip.keys.some(
    (k) => Math.abs(k.t - newT) < 1e-6 && Math.abs(k.t - command.t) >= 1e-6,
  );
  if (collides) {
    return {
      project,
      missing: false,
      invalid: `Cannot move keyframe to ${command.newT} because another keyframe exists at that time.`,
    };
  }

  const keys = clip.keys
    .map((k) => {
      if (Math.abs(k.t - command.t) < 1e-6) {
        return {
          ...k,
          t: newT,
          value: command.newV !== undefined ? command.newV : k.value,
        };
      }
      return k;
    })
    .sort((a, b) => a.t - b.t);

  animations[clipIdx] = { ...clip, keys };
  return {
    project: withLayerAnimations(project, target.layerId, animations),
    missing: false,
  };
}

function deleteKeyframeOnScene(
  project: MotionProject,
  target: NodeTargetRef,
  command: Extract<
    DocumentPropertyCommand,
    { type: "delete-property-keyframe" }
  >,
): PropertyApplyResult {
  const node = findNode(project, target.rootLayerId, target.layerId);
  if (!node || node.type === "audio") return { project, missing: false };
  const property = normalizeAnimationProperty(command.property);
  const animations = [...V1.getLayerAnimations(node)];
  const clipIdx = findAnimationClipIndex(animations, property);
  if (clipIdx < 0) return { project, missing: false };
  const clip = animations[clipIdx]!;
  const keys = clip.keys.filter((k) => Math.abs(k.t - command.t) >= 1e-6);
  if (keys.length === 0) animations.splice(clipIdx, 1);
  else animations[clipIdx] = { ...clip, keys };
  return {
    project: withLayerAnimations(project, target.layerId, animations),
    missing: false,
  };
}

function setKeyframeEasingOnScene(
  project: MotionProject,
  target: NodeTargetRef,
  command: Extract<DocumentPropertyCommand, { type: "set-keyframe-easing" }>,
): PropertyApplyResult {
  const node = findNode(project, target.rootLayerId, target.layerId);
  if (!node || node.type === "audio") return { project, missing: false };
  const property = normalizeAnimationProperty(command.property);
  const animations = [...V1.getLayerAnimations(node)];
  const clipIdx = findAnimationClipIndex(animations, property);
  if (clipIdx < 0) return { project, missing: false };
  const clip = animations[clipIdx]!;
  const keys = clip.keys.map((k) => {
    if (Math.abs(k.t - command.t) < 1e-6) {
      return { ...k, easing: command.easing };
    }
    return k;
  });
  animations[clipIdx] = { ...clip, keys };
  return {
    project: withLayerAnimations(project, target.layerId, animations),
    missing: false,
  };
}

/** Apply một hàm đơn-target lên mọi target, dừng ở lỗi đầu tiên. */
function applyToAllTargets(
  project: MotionProject,
  targets: NodeTargetRef[],
  applyOne: (
    project: MotionProject,
    target: NodeTargetRef,
  ) => PropertyApplyResult,
): PropertyApplyResult {
  let next = project;
  for (const target of targets) {
    const step = applyOne(next, target);
    if (step.missing || step.invalid) return step;
    next = step.project;
  }
  return { project: next, missing: false };
}

export function applyKeyframe(
  project: MotionProject,
  command: Extract<DocumentPropertyCommand, { type: "set-property-keyframe" }>,
): PropertyApplyResult {
  return applyToAllTargets(project, command.targets, (p, t) =>
    upsertKeyframeOnScene(p, t, command),
  );
}

export function moveKeyframes(
  project: MotionProject,
  command: Extract<DocumentPropertyCommand, { type: "move-property-keyframe" }>,
): PropertyApplyResult {
  return applyToAllTargets(project, command.targets, (p, t) =>
    moveKeyframeOnScene(p, t, command),
  );
}

export function deleteKeyframes(
  project: MotionProject,
  command: Extract<
    DocumentPropertyCommand,
    { type: "delete-property-keyframe" }
  >,
): PropertyApplyResult {
  return applyToAllTargets(project, command.targets, (p, t) =>
    deleteKeyframeOnScene(p, t, command),
  );
}

export function setKeyframesEasing(
  project: MotionProject,
  command: Extract<DocumentPropertyCommand, { type: "set-keyframe-easing" }>,
): PropertyApplyResult {
  return applyToAllTargets(project, command.targets, (p, t) =>
    setKeyframeEasingOnScene(p, t, command),
  );
}
