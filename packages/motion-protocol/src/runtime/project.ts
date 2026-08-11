/**
 * MotionRuntimeProject — canonical runtime IR schemas and types.
 *
 * This module OWNS the runtime IR schema definitions.
 * Phase 6: formatVersion bumped to 3, sceneOrder removed.
 */

import { z } from "zod";
import {
  MOTION_PROTOCOL_LIMITS,
  motionEffectPropertyCapability,
  motionPropertyCapability,
  motionPropertyValueError,
} from "../capabilities";
import { ProceduralDriverSchema } from "../v3/animation/drivers";
import { ExtrapolationBehaviorSchema } from "../v3/animation/tracks";
import { KeyframeEasingSchema } from "../v3/animation/easing";
import { AssetSchema } from "./assets";
import {
  AspectRatioSchema,
  FiniteNumberSchema,
  IdSchema,
  PropertyPathSchema,
} from "../v3/common";

/**
 * Runtime IR format version — bumped to 3 (Phase 6)
 * to match the V3 authoring format. No V2-shaped runtime IR remains.
 */
const RUNTIME_IR_FORMAT_VERSION = 3 as const;
import {
  AdjustmentNodeSchema,
  BoneNodeSchema,
  CameraNodeSchema,
  GroupNodeSchema,
  ImageNodeSchema,
  MotionBlurSettingsSchema,
  PathNodeSchema,
  ShapeNodeSchema,
  SolidNodeSchema,
  SvgNodeSchema,
  TextNodeSchema,
  VideoNodeSchema,
} from "./nodes";

// ── Runtime IR schemas (inlined from compat/project) ─────────────────

import { CaptionTrackSchema } from "../v3/captions";
import { contourHasLength, duplicates, morphTopologyMismatch } from "./helpers";
import { LiteralValueSchema, ValueKindSchema } from "../v3/values";

export const PlatformSafeAreaSchema = z
  .object({
    platform: z.enum(["tiktok", "reels", "youtube", "generic"]),
    top: FiniteNumberSchema.nonnegative().max(1).optional(),
    right: FiniteNumberSchema.nonnegative().max(1).optional(),
    bottom: FiniteNumberSchema.nonnegative().max(1).optional(),
    left: FiniteNumberSchema.nonnegative().max(1).optional(),
  })
  .strict();

const DesignTokensSchema = z
  .object({
    colors: z.record(z.string().min(1).max(64)).optional(),
    fonts: z.record(z.string().min(1).max(128)).optional(),
    spacing: z.record(FiniteNumberSchema).optional(),
  })
  .strict();

const BrandSchema = z
  .object({
    name: z.string().min(1),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    logoAssetId: IdSchema.optional(),
    fontFamily: z.string().optional(),
  })
  .strict();

export const ProjectMetadataSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    aspectRatio: AspectRatioSchema,
    fps: FiniteNumberSchema.int()
      .positive()
      .max(MOTION_PROTOCOL_LIMITS.frameRate),
    locale: z.literal("vi-VN"),
    industry: z.string().optional(),
    brand: BrandSchema,
    designTokens: DesignTokensSchema.optional(),
    safeArea: PlatformSafeAreaSchema.optional(),
    description: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const AudioTrackSchema = z
  .object({
    id: IdSchema,
    role: z.enum(["bgm", "voiceover", "sfx"]),
    assetId: IdSchema,
    start: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    trimStart: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds)
      .default(0),
    volume: FiniteNumberSchema.min(0).max(1).default(1),
    loop: z.boolean().default(false),
    fadeIn: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds)
      .default(0),
    fadeOut: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds)
      .default(0),
  })
  .strict();

export const SceneTransitionSchema = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("cut"), duration: z.literal(0).optional() })
    .strict(),
  z
    .object({
      type: z.literal("fade"),
      duration: FiniteNumberSchema.positive().max(
        MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
      ),
      color: z.string().min(1).optional(),
      easing: z
        .enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"])
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("crossfade"),
      duration: FiniteNumberSchema.positive().max(
        MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
      ),
      easing: z
        .enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"])
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("slide"),
      duration: FiniteNumberSchema.positive().max(
        MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
      ),
      direction: z.enum(["left", "right", "up", "down"]),
      mode: z.enum(["push", "cover"]).default("push"),
      easing: z
        .enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"])
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("wipe"),
      duration: FiniteNumberSchema.positive().max(
        MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
      ),
      direction: z.enum(["left", "right", "up", "down"]),
      softness: FiniteNumberSchema.min(0).max(1).optional(),
      easing: z
        .enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"])
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("zoom"),
      duration: FiniteNumberSchema.positive().max(
        MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
      ),
      direction: z.enum(["in", "out"]),
      easing: z
        .enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"])
        .optional(),
    })
    .strict(),
]);

/**
 * Runtime IR version — independent of the project format version.
 * Incremented when the runtime shape changes (new fields, new node types).
 * Renderers check this to reject incompatible IR.
 */
export const MOTION_RUNTIME_VERSION = 1 as const;

const RuntimeNodeSchema = z.discriminatedUnion("type", [
  GroupNodeSchema.omit({ repeat: true }),
  BoneNodeSchema.omit({ repeat: true }),
  TextNodeSchema.omit({ repeat: true, textAnimator: true }),
  ShapeNodeSchema.omit({ repeat: true }),
  PathNodeSchema.omit({ repeat: true }),
  ImageNodeSchema.omit({ repeat: true }),
  SvgNodeSchema.omit({ repeat: true }),
  VideoNodeSchema.omit({ repeat: true }),
  CameraNodeSchema.omit({ repeat: true }),
  SolidNodeSchema.omit({ repeat: true }),
  AdjustmentNodeSchema.omit({ repeat: true }),
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
              MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
            ),
            v: LiteralValueSchema,
            easing: KeyframeEasingSchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.keysPerTrack),
  })
  .strict();

// ── Runtime IR VNext ──────────────────────────────────────────────────
//
// The runtime IR (`MotionRuntimeProject`) is the compiler's serializable
// output. Includes composition-level metadata, an optional visual track
// plan, source refs for error mapping, and runtime hash inputs — all
// OPTIONAL so older IR still parses (backward-compatible schema growth).

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
      .max(MOTION_PROTOCOL_LIMITS.assetDimension),
    height: FiniteNumberSchema.int()
      .positive()
      .max(MOTION_PROTOCOL_LIMITS.assetDimension),
    fps: FiniteNumberSchema.int()
      .positive()
      .max(MOTION_PROTOCOL_LIMITS.frameRate),
    background: z.string().min(1).max(64).optional(),
    colorSpace: z.enum(["srgb", "display-p3"]).default("srgb"),
    audioSampleRate: FiniteNumberSchema.int()
      .positive()
      .max(MOTION_PROTOCOL_LIMITS.sampleRate)
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
 * scenes at compile time but the component variant is kept so tooling can
 * still identify the origin without consulting `sourceRef`.
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
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    duration: FiniteNumberSchema.positive().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    trimStart: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds)
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
      .max(MOTION_PROTOCOL_LIMITS.clipsPerScene),
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

const MotionRuntimeProjectBaseSchema = z
  .object({
    format: z.literal("motion-runtime"),
    formatVersion: z.literal(RUNTIME_IR_FORMAT_VERSION),
    runtimeVersion: z.literal(MOTION_RUNTIME_VERSION).optional(),
    metadata: ProjectMetadataSchema,
    assets: z.array(AssetSchema).max(MOTION_PROTOCOL_LIMITS.assetsPerArtifact),
    composition: RuntimeCompositionMetadataSchema.optional(),
    runtimeHash: z.string().min(1).max(128).optional(),
    compilerVersion: z.string().min(1).max(128).optional(),
    capabilityFingerprint: z.string().min(1).max(128).optional(),
    sourceRef: RuntimeSourceRefMapSchema.optional(),
    timeline: z
      .object({
        visualTracks: z
          .array(RuntimeVisualTrackSchema)
          .min(1)
          .max(MOTION_PROTOCOL_LIMITS.audioTracksPerProject),
        audioTracks: z
          .array(AudioTrackSchema)
          .max(MOTION_PROTOCOL_LIMITS.audioTracksPerProject),
        captionTracks: z
          .array(CaptionTrackSchema)
          .max(MOTION_PROTOCOL_LIMITS.captionTracksPerProject)
          .default([]),
      })
      .strict(),
    scenes: z
      .array(
        z
          .object({
            id: IdSchema,
            duration: FiniteNumberSchema.positive().max(
              MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
            ),
            space: z
              .enum(["flat-2d", "layered-2.5d", "perspective-3d"])
              .optional(),
            motionBlur: MotionBlurSettingsSchema.optional(),
            drivers: z.array(ProceduralDriverSchema).max(512).optional(),
            activeCameraId: IdSchema.optional(),
            /** @deprecated Transitions are clip-level in V3 (transitionIn / transitionOut on visual clips). */
            transition: SceneTransitionSchema.optional(),
            sourceRef: RuntimeSourceRefSchema.optional(),
            nodes: z
              .array(RuntimeNodeSchema)
              .max(MOTION_PROTOCOL_LIMITS.nodesPerScene),
            tracks: z
              .array(RuntimeTrackSchema)
              .max(
                MOTION_PROTOCOL_LIMITS.clipsPerScene *
                  MOTION_PROTOCOL_LIMITS.tracksPerClip,
              ),
          })
          .strict(),
      )
      .max(MOTION_PROTOCOL_LIMITS.scenesPerProject),
  })
  .strict();

export const MotionRuntimeProjectSchema =
  MotionRuntimeProjectBaseSchema.superRefine((runtime, context) => {
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

export type MotionRuntimeProject = z.infer<typeof MotionRuntimeProjectSchema>;

/** Canonical scene/track sub-types */
export type MotionRuntimeScene = MotionRuntimeProject["scenes"][number];
export type MotionRuntimeTrack =
  MotionRuntimeProject["scenes"][number]["tracks"][number];

// ── Deprecated backward-compat aliases ─────────────────────────────────
//
// These will be removed once all consumers migrate.

