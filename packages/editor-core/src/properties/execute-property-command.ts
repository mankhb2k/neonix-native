import {
  MOTION_PROTOCOL_LIMITS,
  motionPropertyCapability,
  setTextPayloadPlain,
  type MotionLayer,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import type { TimelineDocument } from "../document/document";
import { mapNode } from "../timeline/internal/scene-utils";
import { findNode } from "./resolve-targets";
import type {
  DocumentPropertyCommand,
  EffectStackPatch,
  MediaPayloadPatch,
  MetadataPatch,
  NodeTargetRef,
  LayerTimingPatch,
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
  node: MotionLayer,
  patch: TransformPatch,
): MotionLayer {
  if (node.type === "audio") return node;
  const t = node.transform;
  const type = node.type;
  let scaleX = t.scale.x;
  let scaleY = t.scale.y;
  if (patch.lockAspect) {
    const uniform =
      patch.scaleX !== undefined
        ? patch.scaleX
        : patch.scaleY !== undefined
          ? patch.scaleY
          : undefined;
    if (uniform !== undefined) {
      const clamped = clampNumber(uniform, "transform.scale.x", type);
      scaleX = clamped;
      scaleY = clamped;
    }
  } else {
    if (patch.scaleX !== undefined) {
      scaleX = clampNumber(patch.scaleX, "transform.scale.x", type);
    }
    if (patch.scaleY !== undefined) {
      scaleY = clampNumber(patch.scaleY, "transform.scale.y", type);
    }
  }
  return {
    ...node,
    transform: {
      ...t,
      translate: {
        ...t.translate,
        x:
          patch.x !== undefined
            ? clampNumber(patch.x, "transform.translate.x", type)
            : t.translate.x,
        y:
          patch.y !== undefined
            ? clampNumber(patch.y, "transform.translate.y", type)
            : t.translate.y,
      },
      rotate: {
        ...t.rotate,
        z:
          patch.rotation !== undefined
            ? clampNumber(patch.rotation, "transform.rotate.z", type)
            : t.rotate.z,
      },
      scale: { ...t.scale, x: scaleX, y: scaleY },
    },
  };
}

function applyOpacity(node: MotionLayer, opacity: number): MotionLayer {
  if (node.type === "audio") return node;
  return {
    ...node,
    appearance: {
      ...node.appearance,
      opacity: clampNumber(opacity, "appearance.opacity", node.type),
    },
  };
}

function applyMetadata(node: MotionLayer, patch: MetadataPatch): MotionLayer {
  let next: MotionLayer = node;
  if (patch.visible !== undefined) {
      next = {
        ...next,
        appearance: { ...next.appearance, visible: Boolean(patch.visible) },
      };
  }
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) {
      const rest = { ...next };
      delete (rest as { name?: string }).name;
      next = rest as MotionLayer;
    } else {
      next = { ...next, name: name.slice(0, MOTION_PROTOCOL_LIMITS.idLength) };
    }
  }
  return next;
}

function applyStyle(node: MotionLayer, patch: StylePatch): MotionLayer | null {
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
  return { ...node, style: nextStyle } as MotionLayer;
}

function applyText(node: MotionLayer, patch: TextPayloadPatch): MotionLayer | null {
  if (node.type !== "text") return null;
  let payload = { ...node.payload };
  if (patch.text !== undefined) {
    payload = setTextPayloadPlain(payload, patch.text);
  }
  if (patch.fontSize !== undefined) {
    payload.fontSize = clampNumber(
      patch.fontSize,
      "payload.fontSize",
      node.type,
    );
  }
  if (patch.align !== undefined) payload.alignment = patch.align;
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

function applyMedia(node: MotionLayer, patch: MediaPayloadPatch): MotionLayer | null {
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
  return { ...node, payload } as MotionLayer;
}

function applyEffects(node: MotionLayer, patch: EffectStackPatch): MotionLayer {
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

function applyReorderSceneNodes(
  project: MotionProject,
  sceneId: string,
  layerIds: string[],
): { project: MotionProject; missing: boolean } {
  const scene = project.scenes.find((s) => s.id === sceneId);
  if (!scene) return { project, missing: true };

  const byId = new Map(scene.layers.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const ordered: MotionLayer[] = [];
  for (const id of layerIds) {
    if (!id || seen.has(id)) continue;
    const node = byId.get(id);
    if (!node) return { project, missing: true };
    seen.add(id);
    ordered.push(node);
  }
  for (const node of scene.layers) {
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
      scenes: project.scenes.map((s) =>
        s.id === sceneId ? { ...s, layers: withZ } : s,
      ),
    },
    missing: false,
  };
}

function applyTiming(node: MotionLayer, timing: LayerTimingPatch): MotionLayer {
  const start = Math.max(0, timing.start);
  const duration = Math.max(Number.EPSILON, timing.duration);
  return {
    ...node,
    timing: { start, duration },
  } as MotionLayer;
}

function applyToTargets(
  project: MotionProject,
  targets: NodeTargetRef[],
  transform: (node: MotionLayer) => MotionLayer,
): { project: MotionProject; missing: boolean } {
  let next = project;
  for (const target of targets) {
    const scene = next.layers.find((s) => s.id === target.sceneId);
    const node = findNode(next, target.sceneId, target.layerId);
    if (!scene || !node) {
      return { project: next, missing: true };
    }
    next = mapNode(next, target.sceneId, target.layerId, transform);
  }
  return { project: next, missing: false };
}

/** Apply only when transform returns a node; reject if any target is incompatible. */
function applyToCompatibleTargets(
  project: MotionProject,
  targets: NodeTargetRef[],
  transform: (node: MotionLayer) => MotionLayer | null,
): { project: MotionProject; missing: boolean; incompatible: boolean } {
  let next = project;
  for (const target of targets) {
    const scene = next.layers.find((s) => s.id === target.sceneId);
    const node = findNode(next, target.sceneId, target.layerId);
    if (!scene || !node) {
      return { project: next, missing: true, incompatible: false };
    }
    const updated = transform(node);
    if (!updated) {
      return { project: next, missing: false, incompatible: true };
    }
    next = mapNode(next, target.sceneId, target.layerId, () => updated);
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

function clampKeyframeClipDuration(
  currentDuration: number,
  keyTime: number,
): number {
  return Math.min(
    MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    Math.max(currentDuration, keyTime + 0.001),
  );
}

function allocateUniqueClipId(
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
  for (let n = 2; n < 10_000; n += 1) {
    const suffix = `_${n}`;
    const candidate = `${base.slice(0, Math.max(1, maxLen - suffix.length))}${suffix}`;
    if (!existingIds.has(candidate)) return candidate;
  }
  return `${prefix}${fingerprint}_${Date.now()}`.slice(0, maxLen);
}

function upsertKeyframeOnScene(
  project: MotionProject,
  target: NodeTargetRef,
  command: Extract<DocumentPropertyCommand, { type: "set-property-keyframe" }>,
): { project: MotionProject; missing: boolean; invalid?: string } {
  const sceneIdx = project.scenes.findIndex((s) => s.id === target.sceneId);
  if (sceneIdx < 0) return { project, missing: true };
  const scene = project.scenes[sceneIdx]!;
  const node = scene.layers.find((n) => n.id === target.layerId);
  if (!node) return { project, missing: true };

  const clips = [...scene.clips];
  const clipIdx = clips.findIndex(
    (c) =>
      c.layerId === target.layerId &&
      c.source.kind === "propertyAnimations" &&
      c.source.items.some((tr) => tr.property === command.property),
  );
  if (clipIdx < 0) {
    const existingIds = new Set(clips.map((c) => c.id));
    clips.push({
      id: allocateUniqueClipId(existingIds, target.layerId, command.property),
      layerId: target.layerId,
      schedule: { kind: "absolute", at: 0 },
      duration: clampKeyframeClipDuration(scene.duration, command.t),
      playback: { iterations: 1, direction: "normal", rate: 1 },
      source: {
        kind: "propertyAnimations",
        items: [
          {
            layerId: target.layerId,
            property: command.property,
            keys: [
              {
                t: command.t,
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
    if (clip.source.kind !== "propertyAnimations") return { project, missing: true };
    let overflow = false;
    const items = clip.source.items.map((tr) => {
      if (tr.property !== command.property) return tr;
      const keys = [...tr.keys];
      const keyIdx = keys.findIndex((k) => Math.abs(k.t - command.t) < 1e-6);
      const key = {
        t: command.t,
        v: command.v,
        easing: command.easing,
      };
      if (keyIdx >= 0) keys[keyIdx] = key;
      else {
        if (keys.length >= MOTION_PROTOCOL_LIMITS.keysPerAnimation) {
          overflow = true;
          return tr;
        }
        keys.push(key);
        keys.sort((a, b) => a.t - b.t);
      }
      return { ...tr, keys };
    });
    if (overflow) {
      return {
        project,
        missing: false,
        invalid: `Keyframe animation exceeds keysPerAnimation (${MOTION_PROTOCOL_LIMITS.keysPerAnimation}).`,
      };
    }
    clips[clipIdx] = {
      ...clip,
      source: { kind: "propertyAnimations", items },
      duration: clampKeyframeClipDuration(clip.duration, command.t),
    };
  }

  const scenes = project.scenes.slice();
  scenes[sceneIdx] = { ...scene, clips };
  return { project: { ...project, scenes }, missing: false };
}

function applyKeyframe(
  project: MotionProject,
  command: Extract<DocumentPropertyCommand, { type: "set-property-keyframe" }>,
): { project: MotionProject; missing: boolean; invalid?: string } {
  let next = project;
  for (const target of command.targets) {
    const step = upsertKeyframeOnScene(next, target, command);
    if (step.missing) return { project: next, missing: true };
    if (step.invalid) return { project: next, missing: false, invalid: step.invalid };
    next = step.project;
  }
  return { project: next, missing: false };
}

function moveKeyframeOnScene(
  project: MotionProject,
  target: NodeTargetRef,
  command: Extract<DocumentPropertyCommand, { type: "move-property-keyframe" }>,
): { project: MotionProject; missing: boolean; invalid?: string } {
  const sceneIdx = project.scenes.findIndex((s) => s.id === target.sceneId);
  if (sceneIdx < 0) return { project, missing: true };
  const scene = project.scenes[sceneIdx]!;

  const clips = [...scene.clips];
  const clipIdx = clips.findIndex(
    (c) =>
      c.layerId === target.layerId &&
      c.source.kind === "propertyAnimations" &&
      c.source.items.some((tr) => tr.property === command.property),
  );
  if (clipIdx < 0) return { project, missing: false };
  const clip = clips[clipIdx]!;
  if (clip.source.kind !== "propertyAnimations") return { project, missing: false };

  let invalid: string | undefined = undefined;
  const items = clip.source.items.map((tr) => {
    if (tr.property !== command.property) return tr;
    
    // Check collision
    const collides = tr.keys.some(k => Math.abs(k.t - command.newT) < 1e-6 && Math.abs(k.t - command.t) >= 1e-6);
    if (collides) {
      invalid = `Cannot move keyframe to ${command.newT} because another keyframe exists at that time.`;
      return tr;
    }

    const keys = tr.keys.map((k) => {
      if (Math.abs(k.t - command.t) < 1e-6) {
        return {
          ...k,
          t: command.newT,
          v: command.newV !== undefined ? command.newV : k.v,
        };
      }
      return k;
    }).sort((a, b) => a.t - b.t);
    return { ...tr, keys };
  });

  if (invalid) return { project, missing: false, invalid };

  clips[clipIdx] = {
    ...clip,
    duration: clampKeyframeClipDuration(clip.duration, command.newT),
    source: { kind: "propertyAnimations", items },
  };
  const scenes = project.scenes.slice();
  scenes[sceneIdx] = { ...scene, clips };
  return { project: { ...project, scenes }, missing: false };
}

function deleteKeyframeOnScene(
  project: MotionProject,
  target: NodeTargetRef,
  command: Extract<DocumentPropertyCommand, { type: "delete-property-keyframe" }>,
): { project: MotionProject; missing: boolean } {
  const sceneIdx = project.scenes.findIndex((s) => s.id === target.sceneId);
  if (sceneIdx < 0) return { project, missing: true };
  const scene = project.scenes[sceneIdx]!;

  const clips = [...scene.clips];
  const clipIdx = clips.findIndex(
    (c) =>
      c.layerId === target.layerId &&
      c.source.kind === "propertyAnimations" &&
      c.source.items.some((tr) => tr.property === command.property),
  );
  if (clipIdx < 0) return { project, missing: false };
  const clip = clips[clipIdx]!;
  if (clip.source.kind !== "propertyAnimations") return { project, missing: false };

  const items = clip.source.items.map((tr) => {
    if (tr.property !== command.property) return tr;
    const keys = tr.keys.filter((k) => Math.abs(k.t - command.t) >= 1e-6);
    return { ...tr, keys };
  }).filter((tr) => tr.keys.length > 0);

  if (items.length === 0) {
    clips.splice(clipIdx, 1);
  } else {
    clips[clipIdx] = { ...clip, source: { kind: "propertyAnimations", items } };
  }

  const scenes = project.scenes.slice();
  scenes[sceneIdx] = { ...scene, clips };
  return { project: { ...project, scenes }, missing: false };
}

function setKeyframeEasingOnScene(
  project: MotionProject,
  target: NodeTargetRef,
  command: Extract<DocumentPropertyCommand, { type: "set-keyframe-easing" }>,
): { project: MotionProject; missing: boolean } {
  const sceneIdx = project.scenes.findIndex((s) => s.id === target.sceneId);
  if (sceneIdx < 0) return { project, missing: true };
  const scene = project.scenes[sceneIdx]!;

  const clips = [...scene.clips];
  const clipIdx = clips.findIndex(
    (c) =>
      c.layerId === target.layerId &&
      c.source.kind === "propertyAnimations" &&
      c.source.items.some((tr) => tr.property === command.property),
  );
  if (clipIdx < 0) return { project, missing: false };
  const clip = clips[clipIdx]!;
  if (clip.source.kind !== "propertyAnimations") return { project, missing: false };

  const items = clip.source.items.map((tr) => {
    if (tr.property !== command.property) return tr;
    const keys = tr.keys.map((k) => {
      if (Math.abs(k.t - command.t) < 1e-6) {
        return { ...k, easing: command.easing };
      }
      return k;
    });
    return { ...tr, keys };
  });

  clips[clipIdx] = { ...clip, source: { kind: "propertyAnimations", items } };
  const scenes = project.scenes.slice();
  scenes[sceneIdx] = { ...scene, clips };
  return { project: { ...project, scenes }, missing: false };
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
    case "reorder-scene-layers": {
      if (!command.sceneId.trim()) {
        return rejectedInvalid("Scene id is required.");
      }
      if (!command.layerIds.length) {
        return {
          status: "rejected",
          reason: "empty_targets",
          message: "No node ids for reorder.",
        };
      }
      result = applyReorderSceneNodes(
        document.project,
        command.sceneId,
        command.layerIds,
      );
      events = [
        {
          type: "scene-layers-reordered",
          sceneId: command.sceneId,
          layerIds: command.layerIds,
        },
      ];
      break;
    }
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
          return rejectedInvalid("One or more targets are not text layers.");
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
      if (command.patch.op === "upsert-blur") {
        if (!command.patch.effectId?.trim()) {
          return rejectedInvalid("Effect id is required.");
        }
        if (!Number.isFinite(command.patch.radius)) {
          return rejectedInvalid("Blur radius must be a finite number.");
        }
      }
      result = applyToTargets(document.project, command.targets, (node) =>
        applyEffects(node, command.patch),
      );
      events = [{ type: "node-effects-changed", targets: command.targets }];
      break;
    }
    case "set-node-timing": {
      if (!command.targets.length) {
        return {
          status: "rejected",
          reason: "empty_targets",
          message: "No node targets for property command.",
        };
      }
      if (
        collectNonFinite([command.timing.start, command.timing.duration]) ||
        command.timing.duration <= 0 ||
        command.timing.start < 0
      ) {
        return rejectedInvalid(
          "Node timing requires finite start >= 0 and positive duration.",
        );
      }
      result = applyToTargets(document.project, command.targets, (node) =>
        applyTiming(node, command.timing),
      );
      events = [{ type: "node-timing-changed", targets: command.targets }];
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
      if (command.t < 0 || command.t > MOTION_PROTOCOL_LIMITS.mediaDurationSeconds) {
        return rejectedInvalid(
          `Keyframe time must be within 0..${MOTION_PROTOCOL_LIMITS.mediaDurationSeconds}.`,
        );
      }
      if (typeof command.v === "number" && !Number.isFinite(command.v)) {
        return rejectedInvalid("Keyframe value must be finite when numeric.");
      }
      {
        const kf = applyKeyframe(document.project, command);
        if (kf.invalid) {
          return rejectedInvalid(kf.invalid);
        }
        result = kf;
      }
      events = [
        {
          type: "property-keyframe-changed",
          targets: command.targets,
          property: command.property,
        },
      ];
      break;
    }
    case "move-property-keyframe": {
      if (!command.targets.length) return { status: "rejected", reason: "empty_targets", message: "No targets specified." };
      if (!Number.isFinite(command.newT)) return rejectedInvalid("New time must be finite.");
      if (command.newT < 0 || command.newT > MOTION_PROTOCOL_LIMITS.mediaDurationSeconds) return rejectedInvalid("New time out of bounds.");
      if (typeof command.newV === "number" && !Number.isFinite(command.newV)) return rejectedInvalid("Numeric value must be finite.");

      let updated = document.project;
      for (const target of command.targets) {
        const res = moveKeyframeOnScene(updated, target, command);
        if (res.missing) return { status: "rejected", reason: "missing_node", message: "Target node missing." };
        if (res.invalid) return rejectedInvalid(res.invalid);
        updated = res.project;
      }
      result = { project: updated, missing: false };
      events = [{ type: "property-keyframe-changed", targets: command.targets, property: command.property }];
      break;
    }
    case "delete-property-keyframe": {
      if (!command.targets.length) return { status: "rejected", reason: "empty_targets", message: "No targets specified." };
      let updated = document.project;
      for (const target of command.targets) {
        const res = deleteKeyframeOnScene(updated, target, command);
        if (res.missing) return { status: "rejected", reason: "missing_node", message: "Target node missing." };
        updated = res.project;
      }
      result = { project: updated, missing: false };
      events = [{ type: "property-keyframe-changed", targets: command.targets, property: command.property }];
      break;
    }
    case "set-keyframe-easing": {
      if (!command.targets.length) return { status: "rejected", reason: "empty_targets", message: "No targets specified." };
      let updated = document.project;
      for (const target of command.targets) {
        const res = setKeyframeEasingOnScene(updated, target, command);
        if (res.missing) return { status: "rejected", reason: "missing_node", message: "Target node missing." };
        updated = res.project;
      }
      result = { project: updated, missing: false };
      events = [{ type: "property-keyframe-changed", targets: command.targets, property: command.property }];
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
