import { z } from "zod";
import {
  MOTION_V2_LIMITS,
  motionEffectPropertyCapability,
  motionPropertyCapability,
  motionPropertyValueError,
} from "../capabilities";
import { ProceduralDriverSchema } from "./animation/drivers";
import { ExtrapolationBehaviorSchema } from "./animation/tracks";
import { KeyframeEasingV2Schema } from "./animation/easing";
import { AssetV2Schema } from "./assets";
import { FiniteNumberSchema, IdSchema, MOTION_PROJECT_FORMAT_VERSION, PropertyPathSchema } from "./common";
import {
  AdjustmentNodeV2Schema,
  BoneNodeV2Schema,
  CameraNodeV2Schema,
  GroupNodeV2Schema,
  ImageNodeV2Schema,
  MotionBlurSettingsSchema,
  PathNodeV2Schema,
  ShapeNodeV2Schema,
  SolidNodeV2Schema,
  SvgNodeV2Schema,
  TextNodeV2Schema,
  VideoNodeV2Schema,
} from "./nodes";
import { AudioTrackSchema, ProjectMetadataV2Schema, SceneTransitionSchema } from "./project";
import { contourHasLength, duplicates, morphTopologyMismatch } from "./references/helpers";
import { LiteralValueSchema, ValueKindSchema } from "./values";

const RuntimeNodeSchema = z.discriminatedUnion("type", [
  GroupNodeV2Schema.omit({ repeat: true }),
  BoneNodeV2Schema.omit({ repeat: true }),
  TextNodeV2Schema.omit({ repeat: true, textAnimator: true }),
  ShapeNodeV2Schema.omit({ repeat: true }),
  PathNodeV2Schema.omit({ repeat: true }),
  ImageNodeV2Schema.omit({ repeat: true }),
  SvgNodeV2Schema.omit({ repeat: true }),
  VideoNodeV2Schema.omit({ repeat: true }),
  CameraNodeV2Schema.omit({ repeat: true }),
  SolidNodeV2Schema.omit({ repeat: true }),
  AdjustmentNodeV2Schema.omit({ repeat: true }),
]);

const RuntimeTrackSchema = z
  .object({
    targetId: IdSchema,
    property: PropertyPathSchema,
    valueKind: ValueKindSchema.optional(),
    preBehavior: ExtrapolationBehaviorSchema.optional(),
    postBehavior: ExtrapolationBehaviorSchema.optional(),
    keys: z.array(z.object({ t: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds), v: LiteralValueSchema, easing: KeyframeEasingV2Schema.optional() }).strict()).min(1).max(MOTION_V2_LIMITS.keysPerTrack),
  })
  .strict();

const NormalizedMotionProjectV2BaseSchema = z
  .object({
    format: z.literal("motion-runtime"),
    formatVersion: z.literal(MOTION_PROJECT_FORMAT_VERSION),
    metadata: ProjectMetadataV2Schema,
    assets: z.array(AssetV2Schema).max(MOTION_V2_LIMITS.assetsPerArtifact),
    timeline: z.object({
      sceneOrder: z.array(IdSchema).max(MOTION_V2_LIMITS.scenesPerProject),
      audioTracks: z.array(AudioTrackSchema).max(MOTION_V2_LIMITS.audioTracksPerProject),
    }).strict(),
    scenes: z.array(
      z.object({
        id: IdSchema,
        duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
        space: z.enum(["flat-2d", "layered-2.5d"]).optional(),
        motionBlur: MotionBlurSettingsSchema.optional(),
        drivers: z.array(ProceduralDriverSchema).max(512).optional(),
        activeCameraId: IdSchema.optional(),
        transition: SceneTransitionSchema.optional(),
        nodes: z.array(RuntimeNodeSchema).max(MOTION_V2_LIMITS.nodesPerScene),
        tracks: z.array(RuntimeTrackSchema).max(MOTION_V2_LIMITS.clipsPerScene * MOTION_V2_LIMITS.tracksPerClip),
      }).strict(),
    ).max(MOTION_V2_LIMITS.scenesPerProject),
  })
  .strict();

export const NormalizedMotionProjectV2Schema = NormalizedMotionProjectV2BaseSchema.superRefine((runtime, context) => {
  for (let sceneIndex = 0; sceneIndex < runtime.scenes.length; sceneIndex += 1) {
    const scene = runtime.scenes[sceneIndex]!;
    const nodeById = new Map(scene.nodes.map((node) => [node.id, node]));
    if (scene.activeCameraId) {
      const camera = nodeById.get(scene.activeCameraId);
      if (!camera) context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "activeCameraId"], message: `Unknown runtime camera: ${scene.activeCameraId}` });
      else if (camera.type !== "camera") context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "activeCameraId"], message: `Runtime node ${scene.activeCameraId} has type ${camera.type}, expected camera` });
    }
    const secondaryChainOwners = new Map<string, string>();
    for (let nodeIndex = 0; nodeIndex < scene.nodes.length; nodeIndex += 1) {
      const node = scene.nodes[nodeIndex]!;
      const modifiers = node.modifiers ?? [];
      const effects = node.effects ?? [];
      for (const effectId of new Set(duplicates(effects.map((effect) => effect.id)))) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "effects"], message: `Duplicate runtime effect id: ${effectId}` });
      }
      for (const modifierId of new Set(duplicates(modifiers.map((modifier) => modifier.id)))) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: `Duplicate runtime modifier id: ${modifierId}` });
      }
      if (node.type === "path") {
        const morphTargets = node.payload.morphTargets ?? [];
        for (const targetId of new Set(duplicates(morphTargets.map((target) => target.id)))) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "payload", "morphTargets"], message: `Duplicate runtime Path Morph target id: ${targetId}` });
        }
        for (const modifier of modifiers.filter((candidate) => candidate.type === "path-morph")) {
          const targetById = new Map(morphTargets.map((target) => [target.id, target]));
          const fromContours = modifier.from === "base" ? node.payload.contours : targetById.get(modifier.from)?.contours;
          const toContours = targetById.get(modifier.to)?.contours;
          if (modifier.from !== "base" && !fromContours) context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: `Unknown runtime Path Morph target: ${modifier.from}` });
          if (!toContours) context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: `Unknown runtime Path Morph target: ${modifier.to}` });
          if (fromContours && toContours) {
            const mismatch = morphTopologyMismatch(fromContours, toContours);
            if (mismatch) context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: mismatch });
          }
        }
      } else if (modifiers.some((modifier) => modifier.type === "path-morph")) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: "Runtime Path Morph modifier requires a path node" });
      }
      if (modifiers.some((modifier) => modifier.type === "trim-path") && node.type !== "path") {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: "Runtime Trim Path modifier requires a path node" });
      }
      if (modifiers.some((modifier) => modifier.type === "path-bend") && node.type !== "path") {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: "Runtime Path Bend modifier requires a path node" });
      }
      if (modifiers.filter((modifier) => modifier.type === "motion-path").length > 1) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: "Only one runtime motion-path modifier is allowed per node" });
      }
      for (let modifierIndex = 0; modifierIndex < modifiers.length; modifierIndex += 1) {
        const modifier = modifiers[modifierIndex]!;
        const path = ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers", modifierIndex] as Array<string | number>;
        if (modifier.type === "trim-path" && modifier.start > modifier.end) {
          context.addIssue({ code: z.ZodIssueCode.custom, path, message: "Runtime Trim Path end must be >= start" });
        }
        if (modifier.type === "constraint") {
          const target = nodeById.get(modifier.targetNodeId);
          if (!target) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "targetNodeId"], message: `Unknown runtime constraint target: ${modifier.targetNodeId}` });
          else if (modifier.targetNodeId === node.id) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "targetNodeId"], message: "Runtime Constraint cannot target itself" });
        }
        if (modifier.type !== "secondary-motion") continue;
        if (modifier.axis !== "rotation") context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "axis"], message: "Runtime Secondary Motion supports rotation axis only" });
        const driver = nodeById.get(modifier.driverNodeId);
        if (!driver) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "driverNodeId"], message: `Unknown runtime Secondary Motion driver: ${modifier.driverNodeId}` });
        else if (driver.type !== "bone") context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "driverNodeId"], message: `Runtime Secondary Motion driver must be bone: ${modifier.driverNodeId}` });
        if (modifier.driverNodeId !== node.id) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "driverNodeId"], message: "Runtime Secondary Motion modifier must live on its driver node" });
        for (const chainNodeId of modifier.chainNodeIds) {
          const chainNode = nodeById.get(chainNodeId);
          if (!chainNode) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "chainNodeIds"], message: `Unknown runtime Secondary Motion chain node: ${chainNodeId}` });
          else if (chainNode.type !== "bone") context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "chainNodeIds"], message: `Runtime Secondary Motion chain node must be bone: ${chainNodeId}` });
          const owner = secondaryChainOwners.get(chainNodeId);
          if (owner) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "chainNodeIds"], message: `Runtime Secondary Motion chain node already owned: ${chainNodeId}` });
          else secondaryChainOwners.set(chainNodeId, modifier.id);
        }
        for (const chainNodeId of new Set(duplicates(modifier.chainNodeIds))) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "chainNodeIds"], message: `Duplicate runtime Secondary Motion chain node: ${chainNodeId}` });
        }
      }
      for (let modifierIndex = 0; modifierIndex < (node.modifiers?.length ?? 0); modifierIndex += 1) {
        const modifier = node.modifiers![modifierIndex]!;
        if (modifier.type !== "motion-path") continue;
        const source = nodeById.get(modifier.pathNodeId);
        const path = ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers", modifierIndex] as Array<string | number>;
        if (modifier.startOffset > modifier.endOffset) context.addIssue({ code: z.ZodIssueCode.custom, path, message: "Runtime Motion Path endOffset must be >= startOffset" });
        if (!source) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "pathNodeId"], message: `Unknown runtime Motion Path node: ${modifier.pathNodeId}` });
        else if (source.type !== "path") context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "pathNodeId"], message: `Runtime Motion Path source must be path: ${modifier.pathNodeId}` });
        else {
          const contour = source.payload.contours.find((candidate) => candidate.id === modifier.contourId);
          if (!contour) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "contourId"], message: `Unknown runtime Path contour: ${modifier.contourId}` });
          else if (!contourHasLength(contour)) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "contourId"], message: `Runtime Motion Path contour has zero length: ${modifier.contourId}` });
        }
      }
      const seen = new Set([node.id]);
      let current = node;
      while (current) {
        const motionPath = current.modifiers?.find((modifier) => modifier.type === "motion-path");
        if (!motionPath) break;
        if (seen.has(motionPath.pathNodeId)) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"], message: "Runtime Motion Path dependency cycle detected" });
          break;
        }
        seen.add(motionPath.pathNodeId);
        current = nodeById.get(motionPath.pathNodeId)!;
      }
    }
    for (let trackIndex = 0; trackIndex < scene.tracks.length; trackIndex += 1) {
      const track = scene.tracks[trackIndex]!;
      const path = ["scenes", sceneIndex, "tracks", trackIndex] as Array<string | number>;
      const node = nodeById.get(track.targetId);
      if (!node) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "targetId"], message: `Unknown runtime node: ${track.targetId}` });
        continue;
      }
      const modifierMatch = /^modifiers\.([^.]+)\.progress$/.exec(track.property);
      if (modifierMatch && !node.modifiers?.some((modifier) => modifier.id === modifierMatch[1] && (modifier.type === "motion-path" || modifier.type === "path-morph"))) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "property"], message: `Unknown runtime progress modifier: ${modifierMatch[1]}` });
        continue;
      }
      const trimMatch = /^modifiers\.([^.]+)\.(start|end|offset)$/.exec(track.property);
      if (trimMatch && !node.modifiers?.some((modifier) => modifier.id === trimMatch[1] && modifier.type === "trim-path")) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "property"], message: `Unknown runtime trim-path modifier: ${trimMatch[1]}` });
        continue;
      }
      const amountMatch = /^modifiers\.([^.]+)\.amount$/.exec(track.property);
      if (amountMatch && !node.modifiers?.some((modifier) => modifier.id === amountMatch[1] && modifier.type === "path-bend")) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "property"], message: `Unknown runtime path-bend modifier: ${amountMatch[1]}` });
        continue;
      }
      const effectMatch = /^effects\.([^.]+)\.([^.]+)$/.exec(track.property);
      if (effectMatch) {
        const effect = node.effects?.find((candidate) => candidate.id === effectMatch[1]);
        if (!effect) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "property"], message: `Unknown runtime effect: ${effectMatch[1]}` });
          continue;
        }
        if (!motionEffectPropertyCapability(effect.type, effectMatch[2]!)) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "property"], message: `Unsupported runtime property for ${effect.type} effect: ${effectMatch[2]}` });
          continue;
        }
      }
      const capability = motionPropertyCapability(node.type, track.property);
      if (!capability) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "property"], message: `Unsupported runtime property for ${node.type}: ${track.property}` });
        continue;
      }
      if (!capability.animatable || capability.runtimeSupport !== "evaluated") {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "property"], message: `Property is not supported by runtime evaluator: ${track.property}` });
        continue;
      }
      for (let keyIndex = 0; keyIndex < track.keys.length; keyIndex += 1) {
        const message = motionPropertyValueError(capability, track.keys[keyIndex]!.v, track.property);
        if (message) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, "keys", keyIndex, "v"], message });
      }
    }
  }
});
export type NormalizedMotionProjectV2 = z.infer<typeof NormalizedMotionProjectV2Schema>;