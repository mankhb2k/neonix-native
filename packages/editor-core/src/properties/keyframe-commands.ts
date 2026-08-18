/**
 * Keyframe authoring subsystem — mini-domain riêng. allocate id, upsert/move/
 * delete/ease keyframe clips. Không phụ thuộc node patches hay traversal UI.
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

export function clampKeyframeTime(keyTime: number): number {
  return Math.min(
    MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    Math.max(0, keyTime),
  );
}

export function authoringClips(
  project: MotionProject,
): V1.TimelinePropertyClipV1[] {
  return [...(project.timeline.clips ?? [])];
}

export function withAuthoringClips(
  project: MotionProject,
  clips: V1.TimelinePropertyClipV1[],
): MotionProject {
  return {
    ...project,
    timeline: { ...project.timeline, clips },
  };
}

export function allocateUniqueClipId(
  existingIds: Set<string>,
  layerId: string,
  property: string,
): string {
  const maxLen = MOTION_PROTOCOL_LIMITS.idLength;
  const sanitized = property.replace(/\W+/g, "_");
  // Include a short property fingerprint so a.b vs a-b do not collide after sanitize.
  let hash = 0;
  for (let i = 0; i < property.length; i += 1) {
    hash = (hash * 31 + property.charCodeAt(i)) >>> 0;
  }
  const fingerprint = hash.toString(36).slice(0, 6);
  const prefix = `kf_${layerId}_`.slice(0, Math.max(8, maxLen - 24));
  const base = `${prefix}${sanitized}_${fingerprint}`.slice(0, maxLen);
  if (!existingIds.has(base)) return base;

  // Deterministic de-dup: append a stable numeric suffix (no Date.now()).
  // The suffix grows in length as needed, so termination is guaranteed for any
  // finite existingIds set within the protocol id space.
  for (let n = 2; ; n += 1) {
    const suffix = `_${n}`;
    const candidate = `${base.slice(0, Math.max(1, maxLen - suffix.length))}${suffix}`;
    if (!existingIds.has(candidate)) return candidate;
  }
}

function upsertKeyframeOnScene(
  project: MotionProject,
  target: NodeTargetRef,
  command: Extract<DocumentPropertyCommand, { type: "set-property-keyframe" }>,
): PropertyApplyResult {
  const node = findNode(project, target.rootLayerId, target.layerId);
  if (!node) return { project, missing: true };

  const t = clampKeyframeTime(command.t);
  const layerDuration = node.timing?.duration;
  const keyT =
    typeof layerDuration === "number"
      ? Math.min(t, Math.max(0, layerDuration - 1e-6))
      : t;
  const clips = authoringClips(project);
  const clipIdx = clips.findIndex(
    (c) => c.layerId === target.layerId && c.property === command.property,
  );
  const key = {
    t: keyT,
    value: command.v,
    easing: command.easing,
  };
  if (clipIdx < 0) {
    const existingIds = new Set(clips.map((c) => c.id));
    clips.push({
      id: allocateUniqueClipId(existingIds, target.layerId, command.property),
      layerId: target.layerId,
      property: command.property,
      kind: "keyframes",
      keys: [key],
    });
  } else {
    const clip = clips[clipIdx]!;
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
    clips[clipIdx] = { ...clip, keys };
  }

  return { project: withAuthoringClips(project, clips), missing: false };
}

function moveKeyframeOnScene(
  project: MotionProject,
  target: NodeTargetRef,
  command: Extract<DocumentPropertyCommand, { type: "move-property-keyframe" }>,
): PropertyApplyResult {
  const clips = authoringClips(project);
  const clipIdx = clips.findIndex(
    (c) => c.layerId === target.layerId && c.property === command.property,
  );
  if (clipIdx < 0) return { project, missing: false };
  const clip = clips[clipIdx]!;
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

  clips[clipIdx] = { ...clip, keys };
  return { project: withAuthoringClips(project, clips), missing: false };
}

function deleteKeyframeOnScene(
  project: MotionProject,
  target: NodeTargetRef,
  command: Extract<
    DocumentPropertyCommand,
    { type: "delete-property-keyframe" }
  >,
): PropertyApplyResult {
  const clips = authoringClips(project);
  const clipIdx = clips.findIndex(
    (c) => c.layerId === target.layerId && c.property === command.property,
  );
  if (clipIdx < 0) return { project, missing: false };
  const clip = clips[clipIdx]!;
  const keys = clip.keys.filter((k) => Math.abs(k.t - command.t) >= 1e-6);
  if (keys.length === 0) clips.splice(clipIdx, 1);
  else clips[clipIdx] = { ...clip, keys };
  return { project: withAuthoringClips(project, clips), missing: false };
}

function setKeyframeEasingOnScene(
  project: MotionProject,
  target: NodeTargetRef,
  command: Extract<DocumentPropertyCommand, { type: "set-keyframe-easing" }>,
): PropertyApplyResult {
  const clips = authoringClips(project);
  const clipIdx = clips.findIndex(
    (c) => c.layerId === target.layerId && c.property === command.property,
  );
  if (clipIdx < 0) return { project, missing: false };
  const clip = clips[clipIdx]!;
  const keys = clip.keys.map((k) => {
    if (Math.abs(k.t - command.t) < 1e-6) {
      return { ...k, easing: command.easing };
    }
    return k;
  });
  clips[clipIdx] = { ...clip, keys };
  return { project: withAuthoringClips(project, clips), missing: false };
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
