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
import {
  FiniteNumberSchema,
  IdSchema,
  MOTION_PROJECT_FORMAT_VERSION,
  PropertyPathSchema,
} from "./common";
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
import {
  AudioTrackSchema,
  PlatformSafeAreaSchema,
  ProjectMetadataV2Schema,
  SceneTransitionSchema,
} from "./project";
import { CaptionTrackSchema } from "./captions";
import {
  contourHasLength,
  duplicates,
  morphTopologyMismatch,
} from "./references/helpers";
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
    keys: z
      .array(
        z
          .object({
            t: FiniteNumberSchema.nonnegative().max(
              MOTION_V2_LIMITS.mediaDurationSeconds,
            ),
            v: LiteralValueSchema,
            easing: KeyframeEasingV2Schema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(MOTION_V2_LIMITS.keysPerTrack),
  })
  .strict();

// ── Phase 6 — Runtime IR VNext ────────────────────────────────────────
//
// The runtime IR (`NormalizedMotionProjectV2`, aliased `MotionRuntimeIR`)
// is the compiler's serializable output. Phase 6 adds composition-level
// metadata, an optional visual track plan, source refs for error mapping,
// and runtime hash inputs — all OPTIONAL so pre-Phase-6 IR still parses
// (backward-compatible schema growth).

/**
 * Composition-level runtime metadata.
 *
 * Makes the IR self-contained for renderers: pixel dimensions, frame rate,
 * background, color space, and audio sample rate no longer need to be
 * derived from `metadata.aspectRatio` at paint time.
 */
export const RuntimeCompositionMetadataSchema = z
  .object({
    width: FiniteNumberSchema.int()
      .positive()
      .max(MOTION_V2_LIMITS.assetDimension),
    height: FiniteNumberSchema.int()
      .positive()
      .max(MOTION_V2_LIMITS.assetDimension),
    fps: FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.frameRate),
    background: z.string().min(1).max(64).optional(),
    colorSpace: z.enum(["srgb", "display-p3"]).default("srgb"),
    audioSampleRate: FiniteNumberSchema.int()
      .positive()
      .max(MOTION_V2_LIMITS.sampleRate)
      .optional(),
    safeArea: PlatformSafeAreaSchema.optional(),
  })
  .strict();
export type RuntimeCompositionMetadata = z.infer<
  typeof RuntimeCompositionMetadataSchema
>;

/**
 * Source of a runtime visual clip.
 *
 * Scenes are the runtime unit; components are resolved into synthesized
 * scenes at compile time (Phase 5) but the component variant is kept so
 * tooling can still identify the origin without consulting `sourceRef`.
 */
export const RuntimeClipSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("scene"), sceneId: IdSchema }).strict(),
  z.object({ kind: z.literal("component"), componentId: IdSchema }).strict(),
]);
export type RuntimeClipSource = z.infer<typeof RuntimeClipSourceSchema>;

/**
 * A runtime visual clip: an instantiation of a runtime scene on a visual
 * track, with timeline placement and optional playback trimming.
 */
export const RuntimeVisualClipSchema = z
  .object({
    id: IdSchema,
    source: RuntimeClipSourceSchema,
    start: FiniteNumberSchema.nonnegative().max(
      MOTION_V2_LIMITS.mediaDurationSeconds,
    ),
    duration: FiniteNumberSchema.positive().max(
      MOTION_V2_LIMITS.mediaDurationSeconds,
    ),
    trimStart: FiniteNumberSchema.nonnegative()
      .max(MOTION_V2_LIMITS.mediaDurationSeconds)
      .optional(),
    playbackRate: FiniteNumberSchema.positive().max(16).optional(),
    loop: z.boolean().optional(),
    opacity: FiniteNumberSchema.min(0).max(1).optional(),
    transitionIn: SceneTransitionSchema.optional(),
    transitionOut: SceneTransitionSchema.optional(),
  })
  .strict();
export type RuntimeVisualClip = z.infer<typeof RuntimeVisualClipSchema>;

/**
 * A runtime visual track: an ordered list of visual clips.
 */
export const RuntimeVisualTrackSchema = z
  .object({
    id: IdSchema,
    role: z.enum(["primary", "overlay", "background"]),
    order: FiniteNumberSchema.int().nonnegative().optional(),
    muted: z.boolean().optional(),
    clips: z
      .array(RuntimeVisualClipSchema)
      .max(MOTION_V2_LIMITS.clipsPerScene),
  })
  .strict();
export type RuntimeVisualTrack = z.infer<typeof RuntimeVisualTrackSchema>;

/**
 * Per-scene source ref — maps a runtime scene back to its authoring origin
 * (scene id, component id, or timeline clip). Used for debug + error
 * mapping only; deliberately excluded from render hashing.
 */
export const RuntimeSourceRefSchema = z
  .object({
    projectPath: z.array(z.string().min(1)).min(1).max(8),
    sourceModule: z.string().min(1).max(128).optional(),
  })
  .strict();
export type RuntimeSourceRef = z.infer<typeof RuntimeSourceRefSchema>;

/**
 * Project-level source ref index: runtime sceneId → authoring origin
 * description (e.g. `"scenes:intro"`, `"components:button@1.0.0"`).
 */
export const RuntimeSourceRefMapSchema = z
  .object({
    scenes: z.record(z.string().min(1).max(256)),
  })
  .strict();
export type RuntimeSourceRefMap = z.infer<typeof RuntimeSourceRefMapSchema>;

const NormalizedMotionProjectV2BaseSchema = z
  .object({
    format: z.literal("motion-runtime"),
    formatVersion: z.literal(MOTION_PROJECT_FORMAT_VERSION),
    metadata: ProjectMetadataV2Schema,
    assets: z.array(AssetV2Schema).max(MOTION_V2_LIMITS.assetsPerArtifact),
    composition: RuntimeCompositionMetadataSchema.optional(),
    runtimeHash: z.string().min(1).max(128).optional(),
    compilerVersion: z.string().min(1).max(128).optional(),
    capabilityFingerprint: z.string().min(1).max(128).optional(),
    sourceRef: RuntimeSourceRefMapSchema.optional(),
    timeline: z
      .object({
        sceneOrder: z.array(IdSchema).max(MOTION_V2_LIMITS.scenesPerProject),
        visualTracks: z
          .array(RuntimeVisualTrackSchema)
          .max(MOTION_V2_LIMITS.audioTracksPerProject)
          .optional(),
        audioTracks: z
          .array(AudioTrackSchema)
          .max(MOTION_V2_LIMITS.audioTracksPerProject),
        captionTracks: z
          .array(CaptionTrackSchema)
          .max(MOTION_V2_LIMITS.captionTracksPerProject)
          .default([]),
      })
      .strict(),
    scenes: z
      .array(
        z
          .object({
            id: IdSchema,
            duration: FiniteNumberSchema.positive().max(
              MOTION_V2_LIMITS.mediaDurationSeconds,
            ),
            space: z
              .enum(["flat-2d", "layered-2.5d", "perspective-3d"])
              .optional(),
            motionBlur: MotionBlurSettingsSchema.optional(),
            drivers: z.array(ProceduralDriverSchema).max(512).optional(),
            activeCameraId: IdSchema.optional(),
            transition: SceneTransitionSchema.optional(),
            sourceRef: RuntimeSourceRefSchema.optional(),
            nodes: z
              .array(RuntimeNodeSchema)
              .max(MOTION_V2_LIMITS.nodesPerScene),
            tracks: z
              .array(RuntimeTrackSchema)
              .max(
                MOTION_V2_LIMITS.clipsPerScene * MOTION_V2_LIMITS.tracksPerClip,
              ),
          })
          .strict(),
      )
      .max(MOTION_V2_LIMITS.scenesPerProject),
  })
  .strict();

export const NormalizedMotionProjectV2Schema =
  NormalizedMotionProjectV2BaseSchema.superRefine((runtime, context) => {
    for (
      let sceneIndex = 0;
      sceneIndex < runtime.scenes.length;
      sceneIndex += 1
    ) {
      const scene = runtime.scenes[sceneIndex]!;
      const nodeById = new Map(scene.nodes.map((node) => [node.id, node]));
      if (scene.activeCameraId) {
        const camera = nodeById.get(scene.activeCameraId);
        if (!camera)
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["scenes", sceneIndex, "activeCameraId"],
            message: `Unknown runtime camera: ${scene.activeCameraId}`,
          });
        else if (camera.type !== "camera")
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["scenes", sceneIndex, "activeCameraId"],
            message: `Runtime node ${scene.activeCameraId} has type ${camera.type}, expected camera`,
          });
      }
      const secondaryChainOwners = new Map<string, string>();
      for (let nodeIndex = 0; nodeIndex < scene.nodes.length; nodeIndex += 1) {
        const node = scene.nodes[nodeIndex]!;
        const modifiers = node.modifiers ?? [];
        const effects = node.effects ?? [];
        for (const effectId of new Set(
          duplicates(effects.map((effect) => effect.id)),
        )) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["scenes", sceneIndex, "nodes", nodeIndex, "effects"],
            message: `Duplicate runtime effect id: ${effectId}`,
          });
        }
        for (const modifierId of new Set(
          duplicates(modifiers.map((modifier) => modifier.id)),
        )) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"],
            message: `Duplicate runtime modifier id: ${modifierId}`,
          });
        }
        if (node.type === "path") {
          const morphTargets = node.payload.morphTargets ?? [];
          for (const targetId of new Set(
            duplicates(morphTargets.map((target) => target.id)),
          )) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [
                "scenes",
                sceneIndex,
                "nodes",
                nodeIndex,
                "payload",
                "morphTargets",
              ],
              message: `Duplicate runtime Path Morph target id: ${targetId}`,
            });
          }
          for (const modifier of modifiers.filter(
            (candidate) => candidate.type === "path-morph",
          )) {
            const targetById = new Map(
              morphTargets.map((target) => [target.id, target]),
            );
            const fromContours =
              modifier.from === "base"
                ? node.payload.contours
                : targetById.get(modifier.from)?.contours;
            const toContours = targetById.get(modifier.to)?.contours;
            if (modifier.from !== "base" && !fromContours)
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"],
                message: `Unknown runtime Path Morph target: ${modifier.from}`,
              });
            if (!toContours)
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"],
                message: `Unknown runtime Path Morph target: ${modifier.to}`,
              });
            if (fromContours && toContours) {
              const mismatch = morphTopologyMismatch(fromContours, toContours);
              if (mismatch)
                context.addIssue({
                  code: z.ZodIssueCode.custom,
                  path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"],
                  message: mismatch,
                });
            }
          }
        } else if (
          modifiers.some((modifier) => modifier.type === "path-morph")
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"],
            message: "Runtime Path Morph modifier requires a path node",
          });
        }
        if (
          modifiers.some((modifier) => modifier.type === "trim-path") &&
          node.type !== "path"
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"],
            message: "Runtime Trim Path modifier requires a path node",
          });
        }
        if (
          modifiers.some((modifier) => modifier.type === "path-bend") &&
          node.type !== "path"
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"],
            message: "Runtime Path Bend modifier requires a path node",
          });
        }
        if (
          modifiers.filter((modifier) => modifier.type === "motion-path")
            .length > 1
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"],
            message:
              "Only one runtime motion-path modifier is allowed per node",
          });
        }
        for (
          let modifierIndex = 0;
          modifierIndex < modifiers.length;
          modifierIndex += 1
        ) {
          const modifier = modifiers[modifierIndex]!;
          const path = [
            "scenes",
            sceneIndex,
            "nodes",
            nodeIndex,
            "modifiers",
            modifierIndex,
          ] as Array<string | number>;
          if (modifier.type === "trim-path" && modifier.start > modifier.end) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path,
              message: "Runtime Trim Path end must be >= start",
            });
          }
          if (modifier.type === "constraint") {
            const target = nodeById.get(modifier.targetNodeId);
            if (!target)
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...path, "targetNodeId"],
                message: `Unknown runtime constraint target: ${modifier.targetNodeId}`,
              });
            else if (modifier.targetNodeId === node.id)
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...path, "targetNodeId"],
                message: "Runtime Constraint cannot target itself",
              });
          }
          if (modifier.type !== "secondary-motion") continue;
          if (modifier.axis !== "rotation")
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [...path, "axis"],
              message: "Runtime Secondary Motion supports rotation axis only",
            });
          const driver = nodeById.get(modifier.driverNodeId);
          if (!driver)
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [...path, "driverNodeId"],
              message: `Unknown runtime Secondary Motion driver: ${modifier.driverNodeId}`,
            });
          else if (driver.type !== "bone")
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [...path, "driverNodeId"],
              message: `Runtime Secondary Motion driver must be bone: ${modifier.driverNodeId}`,
            });
          if (modifier.driverNodeId !== node.id)
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [...path, "driverNodeId"],
              message:
                "Runtime Secondary Motion modifier must live on its driver node",
            });
          for (const chainNodeId of modifier.chainNodeIds) {
            const chainNode = nodeById.get(chainNodeId);
            if (!chainNode)
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...path, "chainNodeIds"],
                message: `Unknown runtime Secondary Motion chain node: ${chainNodeId}`,
              });
            else if (chainNode.type !== "bone")
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...path, "chainNodeIds"],
                message: `Runtime Secondary Motion chain node must be bone: ${chainNodeId}`,
              });
            const owner = secondaryChainOwners.get(chainNodeId);
            if (owner)
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...path, "chainNodeIds"],
                message: `Runtime Secondary Motion chain node already owned: ${chainNodeId}`,
              });
            else secondaryChainOwners.set(chainNodeId, modifier.id);
          }
          for (const chainNodeId of new Set(
            duplicates(modifier.chainNodeIds),
          )) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [...path, "chainNodeIds"],
              message: `Duplicate runtime Secondary Motion chain node: ${chainNodeId}`,
            });
          }
        }
        for (
          let modifierIndex = 0;
          modifierIndex < (node.modifiers?.length ?? 0);
          modifierIndex += 1
        ) {
          const modifier = node.modifiers![modifierIndex]!;
          if (modifier.type !== "motion-path") continue;
          const source = nodeById.get(modifier.pathNodeId);
          const path = [
            "scenes",
            sceneIndex,
            "nodes",
            nodeIndex,
            "modifiers",
            modifierIndex,
          ] as Array<string | number>;
          if (modifier.startOffset > modifier.endOffset)
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path,
              message: "Runtime Motion Path endOffset must be >= startOffset",
            });
          if (!source)
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [...path, "pathNodeId"],
              message: `Unknown runtime Motion Path node: ${modifier.pathNodeId}`,
            });
          else if (source.type !== "path")
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [...path, "pathNodeId"],
              message: `Runtime Motion Path source must be path: ${modifier.pathNodeId}`,
            });
          else {
            const contour = source.payload.contours.find(
              (candidate) => candidate.id === modifier.contourId,
            );
            if (!contour)
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...path, "contourId"],
                message: `Unknown runtime Path contour: ${modifier.contourId}`,
              });
            else if (!contourHasLength(contour))
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...path, "contourId"],
                message: `Runtime Motion Path contour has zero length: ${modifier.contourId}`,
              });
          }
        }
        const seen = new Set([node.id]);
        let current = node;
        while (current) {
          const motionPath = current.modifiers?.find(
            (modifier) => modifier.type === "motion-path",
          );
          if (!motionPath) break;
          if (seen.has(motionPath.pathNodeId)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["scenes", sceneIndex, "nodes", nodeIndex, "modifiers"],
              message: "Runtime Motion Path dependency cycle detected",
            });
            break;
          }
          seen.add(motionPath.pathNodeId);
          current = nodeById.get(motionPath.pathNodeId)!;
        }
      }
      for (
        let trackIndex = 0;
        trackIndex < scene.tracks.length;
        trackIndex += 1
      ) {
        const track = scene.tracks[trackIndex]!;
        const path = ["scenes", sceneIndex, "tracks", trackIndex] as Array<
          string | number
        >;
        const node = nodeById.get(track.targetId);
        if (!node) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, "targetId"],
            message: `Unknown runtime node: ${track.targetId}`,
          });
          continue;
        }
        const modifierMatch = /^modifiers\.([^.]+)\.progress$/.exec(
          track.property,
        );
        if (
          modifierMatch &&
          !node.modifiers?.some(
            (modifier) =>
              modifier.id === modifierMatch[1] &&
              (modifier.type === "motion-path" ||
                modifier.type === "path-morph"),
          )
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, "property"],
            message: `Unknown runtime progress modifier: ${modifierMatch[1]}`,
          });
          continue;
        }
        const trimMatch = /^modifiers\.([^.]+)\.(start|end|offset)$/.exec(
          track.property,
        );
        if (
          trimMatch &&
          !node.modifiers?.some(
            (modifier) =>
              modifier.id === trimMatch[1] && modifier.type === "trim-path",
          )
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, "property"],
            message: `Unknown runtime trim-path modifier: ${trimMatch[1]}`,
          });
          continue;
        }
        const amountMatch = /^modifiers\.([^.]+)\.amount$/.exec(track.property);
        if (
          amountMatch &&
          !node.modifiers?.some(
            (modifier) =>
              modifier.id === amountMatch[1] && modifier.type === "path-bend",
          )
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, "property"],
            message: `Unknown runtime path-bend modifier: ${amountMatch[1]}`,
          });
          continue;
        }
        const effectMatch = /^effects\.([^.]+)\.([^.]+)$/.exec(track.property);
        if (effectMatch) {
          const effect = node.effects?.find(
            (candidate) => candidate.id === effectMatch[1],
          );
          if (!effect) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [...path, "property"],
              message: `Unknown runtime effect: ${effectMatch[1]}`,
            });
            continue;
          }
          if (!motionEffectPropertyCapability(effect.type, effectMatch[2]!)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [...path, "property"],
              message: `Unsupported runtime property for ${effect.type} effect: ${effectMatch[2]}`,
            });
            continue;
          }
        }
        const capability = motionPropertyCapability(node.type, track.property);
        if (!capability) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, "property"],
            message: `Unsupported runtime property for ${node.type}: ${track.property}`,
          });
          continue;
        }
        if (
          !capability.animatable ||
          capability.runtimeSupport !== "evaluated"
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, "property"],
            message: `Property is not supported by runtime evaluator: ${track.property}`,
          });
          continue;
        }
        for (let keyIndex = 0; keyIndex < track.keys.length; keyIndex += 1) {
          const message = motionPropertyValueError(
            capability,
            track.keys[keyIndex]!.v,
            track.property,
          );
          if (message)
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [...path, "keys", keyIndex, "v"],
              message,
            });
        }
      }
    }
  });
export type NormalizedMotionProjectV2 = z.infer<
  typeof NormalizedMotionProjectV2Schema
>;

/**
 * Alias for the runtime IR type (Phase 6 naming decision).
 *
 * `NormalizedMotionProjectV2` is kept as the canonical name for backward
 * compatibility; `MotionRuntimeIR` is the v3-era name for the same shape.
 * Both names refer to the identical, serializable runtime intermediate
 * representation emitted by the compiler.
 */
export type MotionRuntimeIR = NormalizedMotionProjectV2;
