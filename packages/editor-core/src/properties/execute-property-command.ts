import {
  MOTION_V2_LIMITS,
  motionPropertyCapability,
  type MotionNode,
  type MotionProject,
} from "@motionvideo/motion-schema";
import type { TimelineDocument } from "../document/document";
import { mapNode } from "../timeline/internal/scene-utils";
import type {
  DocumentPropertyCommand,
  EffectStackPatch,
  MediaPayloadPatch,
  MetadataPatch,
  NodeTargetRef,
  PropertyDomainEvent,
  StylePatch,
  TextPayloadPatch,
  TransformPatch,
} from "./property-commands";

export type PropertyCommandResult =
  | {
      status: "applied";
      document: TimelineDocument;
      events: PropertyDomainEvent[];
    }
  | {
      status: "rejected";
      reason: "no_project" | "empty_targets" | "missing_node" | "invalid_value";
      message: string;
    };

function clampNumber(
  value: number,
  capabilityKey: string,
  nodeType: string,
): number {
  const cap = motionPropertyCapability(nodeType, capabilityKey);
  let next = value;
  if (!Number.isFinite(next)) return 0;
  if (cap?.min !== undefined) next = Math.max(cap.min, next);
  if (cap?.minExclusive !== undefined)
    next = Math.max(cap.minExclusive + Number.EPSILON, next);
  if (cap?.max !== undefined) next = Math.min(cap.max, next);
  return next;
}

/** Reject NaN / ±Infinity before Math.min/max (which preserve NaN). */
function collectNonFinite(
  values: Array<number | undefined | null>,
): boolean {
  for (const v of values) {
    if (v === undefined || v === null) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) return true;
  }
  return false;
}

function rejectedInvalid(message: string): PropertyCommandResult {
  return { status: "rejected", reason: "invalid_value", message };
}

function applyTransformPatch(
  node: MotionNode,
  patch: TransformPatch,
): MotionNode {
  const t = node.transform;
  const type = node.type;
  let scaleX = t.scaleX;
  let scaleY = t.scaleY;
  if (patch.lockAspect) {
    const uniform =
      patch.scaleX !== undefined
        ? patch.scaleX
        : patch.scaleY !== undefined
          ? patch.scaleY
          : undefined;
    if (uniform !== undefined) {
      const clamped = clampNumber(uniform, "transform.scaleX", type);
      scaleX = clamped;
      scaleY = clamped;
    }
  } else {
    if (patch.scaleX !== undefined) {
      scaleX = clampNumber(patch.scaleX, "transform.scaleX", type);
    }
    if (patch.scaleY !== undefined) {
      scaleY = clampNumber(patch.scaleY, "transform.scaleY", type);
    }
  }
  return {
    ...node,
    transform: {
      ...t,
      x:
        patch.x !== undefined
          ? clampNumber(patch.x, "transform.x", type)
          : t.x,
      y:
        patch.y !== undefined
          ? clampNumber(patch.y, "transform.y", type)
          : t.y,
      rotation:
        patch.rotation !== undefined
          ? clampNumber(patch.rotation, "transform.rotation", type)
          : t.rotation,
      scaleX,
      scaleY,
    },
  };
}

function applyOpacity(node: MotionNode, opacity: number): MotionNode {
  return {
    ...node,
    transform: {
      ...node.transform,
      opacity: clampNumber(opacity, "transform.opacity", node.type),
    },
  };
}

function applyMetadata(node: MotionNode, patch: MetadataPatch): MotionNode {
  let next: MotionNode = node;
  if (patch.visible !== undefined) {
    next = {
      ...next,
      transform: { ...next.transform, visible: Boolean(patch.visible) },
    };
  }
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) {
      const rest = { ...next };
      delete (rest as { name?: string }).name;
      next = rest as MotionNode;
    } else {
      next = { ...next, name: name.slice(0, MOTION_V2_LIMITS.idLength) };
    }
  }
  return next;
}

function applyStyle(node: MotionNode, patch: StylePatch): MotionNode | null {
  if (
    node.type !== "text" &&
    node.type !== "shape" &&
    node.type !== "path" &&
    node.type !== "svg"
  ) {
    return null;
  }
  const prev =
    "style" in node && node.style && typeof node.style === "object"
      ? { ...node.style }
      : {};
  const nextStyle = { ...prev };
  if (patch.fill !== undefined) nextStyle.fill = patch.fill;
  if (patch.fillOpacity !== undefined) {
    nextStyle.fillOpacity = Math.min(1, Math.max(0, patch.fillOpacity));
  }
  if (patch.stroke !== undefined) nextStyle.stroke = patch.stroke;
  if (patch.strokeWidth !== undefined) {
    nextStyle.strokeWidth = Math.max(0, patch.strokeWidth);
  }
  if (patch.strokeOpacity !== undefined) {
    nextStyle.strokeOpacity = Math.min(1, Math.max(0, patch.strokeOpacity));
  }
  return { ...node, style: nextStyle } as MotionNode;
}

function applyText(node: MotionNode, patch: TextPayloadPatch): MotionNode | null {
  if (node.type !== "text") return null;
  const payload = { ...node.payload };
  if (patch.text !== undefined) payload.text = patch.text;
  if (patch.fontSize !== undefined) {
    payload.fontSize = clampNumber(
      patch.fontSize,
      "payload.fontSize",
      node.type,
    );
  }
  if (patch.fontWeight !== undefined) {
    payload.fontWeight = Math.min(1000, Math.max(1, Math.round(patch.fontWeight)));
  }
  if (patch.align !== undefined) payload.align = patch.align;
  if (patch.lineHeight !== undefined) {
    payload.lineHeight = Math.max(Number.EPSILON, patch.lineHeight);
  }
  if (patch.letterSpacing !== undefined) {
    payload.letterSpacing = patch.letterSpacing;
  }
  return { ...node, payload };
}

function normalizeCrop(crop: {
  x: number;
  y: number;
  width: number;
  height: number;
}): { x: number; y: number; width: number; height: number } {
  const x = Math.min(1, Math.max(0, crop.x));
  const y = Math.min(1, Math.max(0, crop.y));
  let width = Math.min(1, Math.max(Number.EPSILON, crop.width));
  let height = Math.min(1, Math.max(Number.EPSILON, crop.height));
  if (x + width > 1) width = Math.max(Number.EPSILON, 1 - x);
  if (y + height > 1) height = Math.max(Number.EPSILON, 1 - y);
  return { x, y, width, height };
}

function applyMedia(node: MotionNode, patch: MediaPayloadPatch): MotionNode | null {
  if (node.type !== "image" && node.type !== "svg" && node.type !== "video") {
    return null;
  }
  const payload = { ...node.payload } as Record<string, unknown>;
  if (patch.fit !== undefined) payload.fit = patch.fit;
  if (patch.crop !== undefined) {
    const prev =
      "crop" in node.payload &&
      node.payload.crop &&
      typeof node.payload.crop === "object"
        ? (node.payload.crop as {
            x?: number;
            y?: number;
            width?: number;
            height?: number;
          })
        : undefined;
    payload.crop = normalizeCrop({
      x: patch.crop.x,
      y: patch.crop.y,
      width: patch.crop.width ?? prev?.width ?? 1,
      height: patch.crop.height ?? prev?.height ?? 1,
    });
  }
  return { ...node, payload } as MotionNode;
}

function applyEffects(node: MotionNode, patch: EffectStackPatch): MotionNode {
  const effects = [...(node.effects ?? [])];
  if (patch.op === "remove") {
    return {
      ...node,
      effects: effects.filter((e) => e.id !== patch.effectId),
    };
  }
  if (patch.op === "reorder") {
    const seen = new Set<string>();
    const uniqueIds = patch.effectIds.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    const byId = new Map(effects.map((e) => [e.id, e]));
    const next = uniqueIds
      .map((id) => byId.get(id))
      .filter((e): e is NonNullable<typeof e> => Boolean(e));
    for (const e of effects) {
      if (!uniqueIds.includes(e.id)) next.push(e);
    }
    return { ...node, effects: next };
  }
  const radius = Math.max(0, patch.radius);
  const idx = effects.findIndex((e) => e.id === patch.effectId);
  const blur = {
    id: patch.effectId,
    type: "blur" as const,
    radius,
  };
  if (idx >= 0) effects[idx] = blur;
  else effects.push(blur);
  return { ...node, effects };
}

function applyToTargets(
  project: MotionProject,
  targets: NodeTargetRef[],
  transform: (node: MotionNode) => MotionNode,
): { project: MotionProject; missing: boolean } {
  let next = project;
  for (const target of targets) {
    const scene = next.scenes.find((s) => s.id === target.sceneId);
    const node = scene?.nodes.find((n) => n.id === target.nodeId);
    if (!scene || !node) {
      return { project: next, missing: true };
    }
    next = mapNode(next, target.sceneId, target.nodeId, transform);
  }
  return { project: next, missing: false };
}

/** Apply only when transform returns a node; reject if any target is incompatible. */
function applyToCompatibleTargets(
  project: MotionProject,
  targets: NodeTargetRef[],
  transform: (node: MotionNode) => MotionNode | null,
): { project: MotionProject; missing: boolean; incompatible: boolean } {
  let next = project;
  for (const target of targets) {
    const scene = next.scenes.find((s) => s.id === target.sceneId);
    const node = scene?.nodes.find((n) => n.id === target.nodeId);
    if (!scene || !node) {
      return { project: next, missing: true, incompatible: false };
    }
    const updated = transform(node);
    if (!updated) {
      return { project: next, missing: false, incompatible: true };
    }
    next = mapNode(next, target.sceneId, target.nodeId, () => updated);
  }
  return { project: next, missing: false, incompatible: false };
}

function applyAudioTrack(
  project: MotionProject,
  audioTrackId: string,
  patch: DocumentPropertyCommand & { type: "set-audio-track" },
): { project: MotionProject; missing: boolean } {
  const tracks = project.timeline.audioTracks;
  const idx = tracks.findIndex((t) => t.id === audioTrackId);
  if (idx < 0) return { project, missing: true };
  const track = tracks[idx]!;
  const nextTrack = {
    ...track,
    volume:
      patch.patch.volume !== undefined
        ? Math.min(1, Math.max(0, patch.patch.volume))
        : track.volume,
    fadeIn:
      patch.patch.fadeIn !== undefined
        ? Math.max(0, patch.patch.fadeIn)
        : track.fadeIn,
    fadeOut:
      patch.patch.fadeOut !== undefined
        ? Math.max(0, patch.patch.fadeOut)
        : track.fadeOut,
  };
  const audioTracks = tracks.slice();
  audioTracks[idx] = nextTrack;
  return {
    project: {
      ...project,
      timeline: { ...project.timeline, audioTracks },
    },
    missing: false,
  };
}

function upsertKeyframeOnScene(
  project: MotionProject,
  target: NodeTargetRef,
  command: Extract<DocumentPropertyCommand, { type: "set-property-keyframe" }>,
): { project: MotionProject; missing: boolean } {
  const sceneIdx = project.scenes.findIndex((s) => s.id === target.sceneId);
  if (sceneIdx < 0) return { project, missing: true };
  const scene = project.scenes[sceneIdx]!;
  const node = scene.nodes.find((n) => n.id === target.nodeId);
  if (!node) return { project, missing: true };

  const clips = [...scene.clips];
  const clipIdx = clips.findIndex(
    (c) =>
      c.targetId === target.nodeId &&
      c.source.kind === "tracks" &&
      c.source.tracks.some((tr) => tr.property === command.property),
  );
  if (clipIdx < 0) {
    clips.push({
      id: `kf_${target.nodeId}_${command.property.replace(/\W+/g, "_")}`,
      targetId: target.nodeId,
      schedule: { kind: "absolute", at: 0 },
      duration: Math.max(scene.duration, command.t + 0.001),
      playback: { iterations: 1, direction: "normal", rate: 1 },
      source: {
        kind: "tracks",
        tracks: [
          {
            targetId: target.nodeId,
            property: command.property,
            keys: [
              {
                t: Math.max(0, command.t),
                v: command.v,
                easing: command.easing,
              },
            ],
          },
        ],
      },
    });
  } else {
    const clip = clips[clipIdx]!;
    if (clip.source.kind !== "tracks") return { project, missing: true };
    const tracks = clip.source.tracks.map((tr) => {
      if (tr.property !== command.property) return tr;
      const keys = [...tr.keys];
      const keyIdx = keys.findIndex((k) => Math.abs(k.t - command.t) < 1e-6);
      const key = {
        t: Math.max(0, command.t),
        v: command.v,
        easing: command.easing,
      };
      if (keyIdx >= 0) keys[keyIdx] = key;
      else {
        keys.push(key);
        keys.sort((a, b) => a.t - b.t);
      }
      return { ...tr, keys };
    });
    clips[clipIdx] = {
      ...clip,
      source: { kind: "tracks", tracks },
      duration: Math.max(clip.duration, command.t + 0.001),
    };
  }

  const scenes = project.scenes.slice();
  scenes[sceneIdx] = { ...scene, clips };
  return { project: { ...project, scenes }, missing: false };
}

function applyKeyframe(
  project: MotionProject,
  command: Extract<DocumentPropertyCommand, { type: "set-property-keyframe" }>,
): { project: MotionProject; missing: boolean } {
  let next = project;
  for (const target of command.targets) {
    const step = upsertKeyframeOnScene(next, target, command);
    if (step.missing) return { project: next, missing: true };
    next = step.project;
  }
  return { project: next, missing: false };
}

export function executePropertyCommand(
  document: TimelineDocument,
  command: DocumentPropertyCommand,
): PropertyCommandResult {
  if (!document.project) {
    return {
      status: "rejected",
      reason: "no_project",
      message: "No project loaded.",
    };
  }

  let result: { project: MotionProject; missing: boolean };
  let events: PropertyDomainEvent[];

  switch (command.type) {
    case "set-node-transform": {
      if (!command.targets.length) {
        return {
          status: "rejected",
          reason: "empty_targets",
          message: "No node targets for property command.",
        };
      }
      if (
        command.patch.x === undefined &&
        command.patch.y === undefined &&
        command.patch.rotation === undefined &&
        command.patch.scaleX === undefined &&
        command.patch.scaleY === undefined
      ) {
        return rejectedInvalid("Empty transform patch.");
      }
      if (
        collectNonFinite([
          command.patch.x,
          command.patch.y,
          command.patch.rotation,
          command.patch.scaleX,
          command.patch.scaleY,
        ])
      ) {
        return rejectedInvalid("Transform values must be finite numbers.");
      }
      result = applyToTargets(document.project, command.targets, (node) =>
        applyTransformPatch(node, command.patch),
      );
      events = [
        { type: "node-transform-changed", targets: command.targets },
      ];
      break;
    }
    case "set-node-opacity": {
      if (!command.targets.length) {
        return {
          status: "rejected",
          reason: "empty_targets",
          message: "No node targets for property command.",
        };
      }
      if (!Number.isFinite(command.opacity)) {
        return rejectedInvalid("Opacity must be a finite number.");
      }
      result = applyToTargets(document.project, command.targets, (node) =>
        applyOpacity(node, command.opacity),
      );
      events = [{ type: "node-opacity-changed", targets: command.targets }];
      break;
    }
    case "set-node-metadata": {
      if (!command.targets.length) {
        return {
          status: "rejected",
          reason: "empty_targets",
          message: "No node targets for property command.",
        };
      }
      if (
        command.patch.name === undefined &&
        command.patch.visible === undefined
      ) {
        return {
          status: "rejected",
          reason: "invalid_value",
          message: "Empty metadata patch.",
        };
      }
      result = applyToTargets(document.project, command.targets, (node) =>
        applyMetadata(node, command.patch),
      );
      events = [
        { type: "node-metadata-changed", targets: command.targets },
      ];
      break;
    }
    case "set-node-style": {
      if (!command.targets.length) {
        return {
          status: "rejected",
          reason: "empty_targets",
          message: "No node targets for property command.",
        };
      }
      if (
        command.patch.fill === undefined &&
        command.patch.fillOpacity === undefined &&
        command.patch.stroke === undefined &&
        command.patch.strokeWidth === undefined &&
        command.patch.strokeOpacity === undefined
      ) {
        return rejectedInvalid("Empty style patch.");
      }
      if (
        collectNonFinite([
          command.patch.fillOpacity,
          command.patch.strokeWidth,
          command.patch.strokeOpacity,
        ])
      ) {
        return rejectedInvalid("Style numeric values must be finite.");
      }
      {
        const compat = applyToCompatibleTargets(
          document.project,
          command.targets,
          (node) => applyStyle(node, command.patch),
        );
        if (compat.incompatible) {
          return rejectedInvalid("One or more targets do not support style.");
        }
        result = compat;
      }
      events = [{ type: "node-style-changed", targets: command.targets }];
      break;
    }
    case "set-node-text": {
      if (!command.targets.length) {
        return {
          status: "rejected",
          reason: "empty_targets",
          message: "No node targets for property command.",
        };
      }
      if (
        collectNonFinite([
          command.patch.fontSize,
          command.patch.fontWeight,
          command.patch.lineHeight,
          command.patch.letterSpacing,
        ])
      ) {
        return rejectedInvalid("Text numeric values must be finite.");
      }
      {
        const compat = applyToCompatibleTargets(
          document.project,
          command.targets,
          (node) => applyText(node, command.patch),
        );
        if (compat.incompatible) {
          return rejectedInvalid("One or more targets are not text nodes.");
        }
        result = compat;
      }
      events = [{ type: "node-text-changed", targets: command.targets }];
      break;
    }
    case "set-node-media": {
      if (!command.targets.length) {
        return {
          status: "rejected",
          reason: "empty_targets",
          message: "No node targets for property command.",
        };
      }
      if (command.patch.fit === undefined && command.patch.crop === undefined) {
        return rejectedInvalid("Empty media patch.");
      }
      if (
        command.patch.crop &&
        collectNonFinite([
          command.patch.crop.x,
          command.patch.crop.y,
          command.patch.crop.width,
          command.patch.crop.height,
        ])
      ) {
        return rejectedInvalid("Crop values must be finite numbers.");
      }
      {
        const compat = applyToCompatibleTargets(
          document.project,
          command.targets,
          (node) => applyMedia(node, command.patch),
        );
        if (compat.incompatible) {
          return rejectedInvalid(
            "One or more targets do not support media payload.",
          );
        }
        result = compat;
      }
      events = [{ type: "node-media-changed", targets: command.targets }];
      break;
    }
    case "set-audio-track": {
      if (
        command.patch.volume === undefined &&
        command.patch.fadeIn === undefined &&
        command.patch.fadeOut === undefined
      ) {
        return rejectedInvalid("Empty audio patch.");
      }
      if ("speed" in command.patch && (command.patch as { speed?: unknown }).speed !== undefined) {
        return rejectedInvalid("AudioTrack has no speed field; rejected.");
      }
      if (
        collectNonFinite([
          command.patch.volume,
          command.patch.fadeIn,
          command.patch.fadeOut,
        ])
      ) {
        return rejectedInvalid("Audio values must be finite numbers.");
      }
      result = applyAudioTrack(
        document.project,
        command.audioTrackId,
        command,
      );
      events = [
        { type: "audio-track-changed", audioTrackId: command.audioTrackId },
      ];
      break;
    }
    case "set-node-effects": {
      if (!command.targets.length) {
        return {
          status: "rejected",
          reason: "empty_targets",
          message: "No node targets for property command.",
        };
      }
      result = applyToTargets(document.project, command.targets, (node) =>
        applyEffects(node, command.patch),
      );
      events = [{ type: "node-effects-changed", targets: command.targets }];
      break;
    }
    case "set-property-keyframe": {
      if (!command.targets.length) {
        return {
          status: "rejected",
          reason: "empty_targets",
          message: "No node targets for property command.",
        };
      }
      if (!command.property.trim()) {
        return rejectedInvalid("Keyframe property path required.");
      }
      if (!Number.isFinite(command.t)) {
        return rejectedInvalid("Keyframe time must be a finite number.");
      }
      if (typeof command.v === "number" && !Number.isFinite(command.v)) {
        return rejectedInvalid("Keyframe value must be finite when numeric.");
      }
      result = applyKeyframe(document.project, command);
      events = [
        {
          type: "property-keyframe-changed",
          targets: command.targets,
          property: command.property,
        },
      ];
      break;
    }
    default: {
      const _exhaustive: never = command;
      return {
        status: "rejected",
        reason: "invalid_value",
        message: `Unknown command: ${JSON.stringify(_exhaustive)}`,
      };
    }
  }

  if (result.missing) {
    return {
      status: "rejected",
      reason: "missing_node",
      message: "One or more targets were not found.",
    };
  }

  return {
    status: "applied",
    document: {
      ...document,
      project: result.project,
    },
    events,
  };
}
