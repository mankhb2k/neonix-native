import type { z } from "zod";
import { motionPropertyCapability, motionPropertyValueError } from "../../capabilities";
import type { MotionClip } from "../animation/clips";
import { CutoutVariantSlotSchema } from "../component";
import type { MotionNode } from "../nodes";
import { VariableV2Schema } from "../variables";
import { duplicates } from "./helpers";
import { validatePropertyPath, validateVariableCapabilityValue } from "./property-path";
import type { ReferenceIssue } from "./types";

export function clipScheduleStarts(clips: Array<MotionClip>): Map<string, number> {
  const byId = new Map(clips.map((clip) => [clip.id, clip]));
  const starts = new Map<string, number>();
  const visiting = new Set<string>();
  const resolve = (clip: MotionClip): number | undefined => {
    const cached = starts.get(clip.id);
    if (cached !== undefined) return cached;
    if (visiting.has(clip.id)) return undefined;
    visiting.add(clip.id);
    let start: number | undefined;
    if (clip.schedule.kind === "absolute") start = clip.schedule.at;
    else {
      const dependency = byId.get(clip.schedule.clipId);
      const dependencyStart = dependency ? resolve(dependency) : undefined;
      if (dependency && dependencyStart !== undefined) start = dependencyStart + (clip.schedule.kind === "after" ? dependency.duration : 0) + (clip.schedule.offset ?? 0);
    }
    visiting.delete(clip.id);
    if (start !== undefined) starts.set(clip.id, start);
    return start;
  };
  for (const clip of clips) resolve(clip);
  return starts;
}

export function validateClips(
  clips: Array<MotionClip>,
  nodes: Array<MotionNode>,
  variables: Array<z.infer<typeof VariableV2Schema>>,
  prefix: string,
  options: {
    allowComponentAction?: boolean;
    variantSlots?: Map<string, z.infer<typeof CutoutVariantSlotSchema>>;
  } = {},
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const variableById = new Map(variables.map((variable) => [variable.id, variable]));
  const clipById = new Map(clips.map((clip) => [clip.id, clip]));
  for (const id of new Set(duplicates(clips.map((clip) => clip.id)))) issues.push({ path: prefix, message: `Duplicate clip id: ${id}` });
  for (const clip of clips) {
    if (clip.targetId && !nodeById.has(clip.targetId)) issues.push({ path: `${prefix}.${clip.id}.targetId`, message: `Unknown node: ${clip.targetId}` });
    if (clip.targetId) {
      const target = nodeById.get(clip.targetId);
      if (target?.type === "text" && target.textAnimator) issues.push({ path: `${prefix}.${clip.id}.targetId`, message: "Text Animator node cannot be targeted by authored clips; animate its parent or animator properties" });
    }
    if (clip.source.kind === "component-action") {
      const target = clip.targetId ? nodeById.get(clip.targetId) : undefined;
      if (!options.allowComponentAction) issues.push({ path: `${prefix}.${clip.id}.source`, message: "Component Action invocation is only allowed in Project scenes" });
      if (!clip.targetId) issues.push({ path: `${prefix}.${clip.id}.targetId`, message: "Component Action requires a target Component instance" });
      else if (target && target.type !== "component") issues.push({ path: `${prefix}.${clip.id}.targetId`, message: `Component Action target has type ${target.type}, expected component` });
    }
    if (clip.schedule.kind !== "absolute" && !clipById.has(clip.schedule.clipId)) {
      issues.push({ path: `${prefix}.${clip.id}.schedule`, message: `Unknown schedule clip: ${clip.schedule.clipId}` });
    }
    if (clip.source.kind === "tracks") {
      for (const track of clip.source.tracks) {
        const trackPath = `${prefix}.${clip.id}.source.tracks.${track.property}`;
        const node = nodeById.get(track.targetId);
        const variantSlot = options.variantSlots?.get(track.targetId);
        const isVariantTrack = track.property === "payload.variantId";
        if (!node) issues.push({ path: trackPath, message: `Unknown node: ${track.targetId}` });
        if (node?.type === "text" && node.textAnimator) issues.push({ path: trackPath, message: "Text Animator node cannot be targeted by authored tracks; animate its parent or animator properties" });
        if (isVariantTrack && !variantSlot) issues.push({ path: trackPath, message: `Variant track target is not a cut-out slot: ${track.targetId}` });
        const capability = node && !isVariantTrack ? motionPropertyCapability(node.type, track.property) : undefined;
        if (node && !isVariantTrack) issues.push(...validatePropertyPath(node, track.property, "track", trackPath));
        for (let index = 0; index < track.keys.length; index += 1) {
          const key = track.keys[index]!;
          const keyTime = typeof key.t === "number" ? key.t : key.t.offset;
          const prevAbsolute =
            index > 0 && typeof track.keys[index - 1]!.t === "number"
              ? (track.keys[index - 1]!.t as number)
              : undefined;
          if (keyTime > clip.duration) issues.push({ path: trackPath, message: `Key time ${keyTime} exceeds clip duration ${clip.duration}` });
          // Marker-relative times resolve at compile; only order absolute seconds here.
          if (typeof key.t === "number" && prevAbsolute !== undefined && key.t <= prevAbsolute) {
            issues.push({ path: trackPath, message: "Key times must be strictly increasing" });
            break;
          }
          if (isVariantTrack && variantSlot) {
            if (typeof key.v !== "string" || !variantSlot.variants.some((variant) => variant.id === key.v)) {
              issues.push({ path: trackPath, message: `Unknown variant ${String(key.v)} for slot ${variantSlot.id}` });
            }
          } else if (capability) {
            const value = key.v;
            const referenceValue = value !== null && typeof value === "object" && !Array.isArray(value)
              ? value as { ref?: { kind?: unknown; id?: unknown }; map?: { scale?: number; offset?: number } }
              : undefined;
            const reference = referenceValue?.ref;
            if (reference?.kind === "variable" && typeof reference.id === "string") {
              const variable = variableById.get(reference.id);
              if (variable) {
                const message = validateVariableCapabilityValue(variable, capability, track.property, referenceValue?.map);
                if (message) issues.push({ path: trackPath, message });
              }
            } else {
              const message = motionPropertyValueError(capability, value, track.property);
              if (message) issues.push({ path: trackPath, message });
            }
          }
        }
      }
    }
  }
  for (const clip of clips) {
    const seen = new Set<string>([clip.id]);
    let cursor = clip;
    while (cursor.schedule.kind !== "absolute") {
      const dependencyId = cursor.schedule.clipId;
      if (seen.has(dependencyId)) {
        issues.push({ path: `${prefix}.${clip.id}.schedule`, message: "Clip schedule cycle detected" });
        break;
      }
      seen.add(dependencyId);
      const dependency = clipById.get(dependencyId);
      if (!dependency) break;
      cursor = dependency;
    }
  }
  return issues;
}
