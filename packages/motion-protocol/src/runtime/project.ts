/**
 * MotionRuntimeProject — canonical runtime IR schemas and types.
 *
 * Authoring and runtime share one layer graph: `layers` + animation `tracks`.
 * There is no serialized `scenes` array or visual/audio clip tracks.
 */

import { z } from "zod";
import {
  MOTION_PROTOCOL_LIMITS,
  motionEffectPropertyCapability,
  motionPropertyCapability,
  motionPropertyValueError,
} from "../capabilities";
import { ProceduralDriverSchema } from "../v1/animation/drivers";
import { ExtrapolationBehaviorSchema } from "../v1/animation/tracks";
import { KeyframeEasingSchema } from "../v1/animation/easing";
import { AssetSchema } from "./assets";
import {
  AspectRatioSchema,
  FiniteNumberSchema,
  IdSchema,
  PropertyPathSchema,
} from "../v1/common";

/**
 * Runtime IR format version — 1, matching V1 authoring.
 */
const RUNTIME_IR_FORMAT_VERSION = 1 as const;
import {
  AdjustmentLayerSchema,
  BoneLayerSchema,
  CameraLayerSchema,
  GroupLayerSchema,
  ImageLayerSchema,
  MotionBlurSettingsSchema,
  PathLayerSchema,
  RuntimeAudioLayerSchema,
  ShapeLayerSchema,
  SolidLayerSchema,
  SvgLayerSchema,
  TextLayerSchema,
  VideoLayerSchema,
} from "./layers";

// ── Runtime IR schemas ────────────────────────────────────────────────

import { contourHasLength, duplicates, morphTopologyMismatch } from "./helpers";
import { LiteralValueSchema, ValueKindSchema } from "../v1/values";

export const PlatformSafeAreaSchema = z
  .object({
    platform: z.enum(["tiktok", "reels", "youtube", "generic"]),
    top: FiniteNumberSchema.nonnegative().max(1).optional(),
    right: FiniteNumberSchema.nonnegative().max(1).optional(),
    bottom: FiniteNumberSchema.nonnegative().max(1).optional(),
    left: FiniteNumberSchema.nonnegative().max(1).optional(),
  })
  .strict();
export type PlatformSafeArea = z.infer<typeof PlatformSafeAreaSchema>;

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
export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;

export const AudioClipSchema = z
  .object({
    id: IdSchema,
    assetId: IdSchema,
    start: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    duration: FiniteNumberSchema.positive().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    trimStart: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds)
      .default(0),
    trimEnd: FiniteNumberSchema.positive()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds)
      .optional(),
    playbackRate: FiniteNumberSchema.positive()
      .max(MOTION_PROTOCOL_LIMITS.transformScale)
      .default(1),
    volume: FiniteNumberSchema.min(0).max(1).default(1),
    loop: z.boolean().default(false),
    fadeIn: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds)
      .default(0),
    fadeOut: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds)
      .default(0),
    muted: z.boolean().default(false),
  })
  .strict()
  .superRefine((clip, ctx) => {
    if (clip.trimEnd !== undefined && clip.trimEnd > clip.duration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `trimEnd (${clip.trimEnd}) must be ≤ duration (${clip.duration})`,
        path: ["trimEnd"],
      });
    }
    if (clip.fadeIn + clip.fadeOut > clip.duration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `fadeIn (${clip.fadeIn}) + fadeOut (${clip.fadeOut}) must be ≤ duration (${clip.duration})`,
        path: ["fadeIn"],
      });
    }
  });
export type AudioClip = z.infer<typeof AudioClipSchema>;

export const AudioTrackSchema = z
  .object({
    id: IdSchema,
    /** Sparse ordering key; must be < 0. Unique across all timeline tracks. */
    order: FiniteNumberSchema.int().negative(),
    muted: z.boolean().default(false),
    clips: z
      .array(AudioClipSchema)
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.clipsPerScene),
  })
  .strict();
export type AudioTrack = z.infer<typeof AudioTrackSchema>;

/** @deprecated Timeline transitions removed — kept only if legacy IR still references types. */
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
export type SceneTransition = z.infer<typeof SceneTransitionSchema>;

/**
 * Runtime IR version — independent of the project format version.
 * Incremented when the runtime shape changes (new fields, new node types).
 * Renderers check this to reject incompatible IR.
 */
export const MOTION_RUNTIME_VERSION = 2 as const;

const RuntimeVisualLayerSchema = z.discriminatedUnion("type", [
  GroupLayerSchema.omit({ repeat: true }),
  BoneLayerSchema.omit({ repeat: true }),
  TextLayerSchema.omit({ repeat: true, textAnimator: true }),
  ShapeLayerSchema.omit({ repeat: true }),
  PathLayerSchema.omit({ repeat: true }),
  ImageLayerSchema.omit({ repeat: true }),
  SvgLayerSchema.omit({ repeat: true }),
  VideoLayerSchema.omit({ repeat: true }),
  CameraLayerSchema.omit({ repeat: true }),
  SolidLayerSchema.omit({ repeat: true }),
  AdjustmentLayerSchema.omit({ repeat: true }),
]);

const RuntimeLayerSchema = z.discriminatedUnion("type", [
  GroupLayerSchema.omit({ repeat: true }),
  BoneLayerSchema.omit({ repeat: true }),
  TextLayerSchema.omit({ repeat: true, textAnimator: true }),
  ShapeLayerSchema.omit({ repeat: true }),
  PathLayerSchema.omit({ repeat: true }),
  ImageLayerSchema.omit({ repeat: true }),
  SvgLayerSchema.omit({ repeat: true }),
  VideoLayerSchema.omit({ repeat: true }),
  CameraLayerSchema.omit({ repeat: true }),
  SolidLayerSchema.omit({ repeat: true }),
  AdjustmentLayerSchema.omit({ repeat: true }),
  RuntimeAudioLayerSchema,
]);

const RuntimeTrackSchema = z
  .object({
    layerId: IdSchema,
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
 * Source of a runtime visual clip — removed from IR; kept only for type export
 * during renderer migration. Runtime no longer serializes visual clips.
 */
export const RuntimeClipSourceSchema = z
  .object({ kind: z.literal("scene"), sceneId: IdSchema })
  .strict();
export type RuntimeClipSource = z.infer<typeof RuntimeClipSourceSchema>;

/**
 * A runtime visual clip: occupancy on a visual track + source to render.
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
  })
  .strict();
export type RuntimeVisualClip = z.infer<typeof RuntimeVisualClipSchema>;

/**
 * A runtime visual track: time-exclusive lane; `order` is stacking order.
 */
export const RuntimeVisualTrackSchema = z
  .object({
    id: IdSchema,
    order: FiniteNumberSchema.int().nonnegative(),
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
    layers: z.record(z.string().min(1).max(256)),
  })
  .strict();
export type RuntimeSourceRefMap = z.infer<typeof RuntimeSourceRefMapSchema>;

/**
 * In-memory layer graph for evaluators (not a serialized scene).
 * Compiler lifts this onto `MotionRuntimeProject.layers` / `.tracks`.
 */
export const RuntimeLayerGraphSchema = z
  .object({
    id: IdSchema,
    duration: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    space: z.enum(["flat-2d", "layered-2.5d", "perspective-3d"]).optional(),
    motionBlur: MotionBlurSettingsSchema.optional(),
    drivers: z.array(ProceduralDriverSchema).max(512).optional(),
    activeCameraLayerId: IdSchema.optional(),
    sourceRef: RuntimeSourceRefSchema.optional(),
    layers: z
      .array(RuntimeVisualLayerSchema)
      .max(MOTION_PROTOCOL_LIMITS.layersPerScene),
    tracks: z
      .array(RuntimeTrackSchema)
      .max(
        MOTION_PROTOCOL_LIMITS.clipsPerScene *
          MOTION_PROTOCOL_LIMITS.tracksPerClip,
      )
      .default([]),
  })
  .strict();
export type RuntimeLayerGraph = z.infer<typeof RuntimeLayerGraphSchema>;
/** @deprecated Use RuntimeLayerGraph — no serialized scenes. */
export const RuntimeSceneSchema = RuntimeLayerGraphSchema;
export type RuntimeScene = RuntimeLayerGraph;

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
    space: z.enum(["flat-2d", "layered-2.5d", "perspective-3d"]).optional(),
    motionBlur: MotionBlurSettingsSchema.optional(),
    drivers: z.array(ProceduralDriverSchema).max(512).optional(),
    activeCameraLayerId: IdSchema.optional(),
    layers: z
      .array(RuntimeLayerSchema)
      .max(MOTION_PROTOCOL_LIMITS.layersPerScene)
      .default([]),
    tracks: z
      .array(RuntimeTrackSchema)
      .max(
        MOTION_PROTOCOL_LIMITS.clipsPerScene *
          MOTION_PROTOCOL_LIMITS.tracksPerClip,
      )
      .default([]),
    timeline: z
      .object({
        duration: FiniteNumberSchema.nonnegative().max(
          MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
        ),
      })
      .strict(),
  })
  .strict();

export const MotionRuntimeProjectSchema =
  MotionRuntimeProjectBaseSchema.superRefine((runtime, context) => {
    const timelineDuration = runtime.timeline.duration;
    const layers = runtime.layers;
    const layerById = new Map(
      layers.map((node) => [node.id, node] as const),
    );
    if (runtime.activeCameraLayerId) {
      const camera = layerById.get(runtime.activeCameraLayerId);
      if (!camera)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["activeCameraLayerId"],
          message: `Unknown runtime camera: ${runtime.activeCameraLayerId}`,
        });
      else if (camera.type !== "camera")
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["activeCameraLayerId"],
          message: `Runtime node ${runtime.activeCameraLayerId} has type ${camera.type}, expected camera`,
        });
    }
    const secondaryChainOwners = new Map<string, string>();
    for (let nodeIndex = 0; nodeIndex < layers.length; nodeIndex += 1) {
      const node = layers[nodeIndex]!;
      if (
        node.timing &&
        node.timing.start + node.timing.duration > timelineDuration + 1e-9
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["layers", nodeIndex, "timing"],
          message: `Runtime layer "${node.id}" ends at ${node.timing.start + node.timing.duration} beyond timeline.duration (${timelineDuration})`,
        });
      }
      if (node.type === "audio") continue;
      const modifiers = node.modifiers ?? [];
      const effects = node.effects ?? [];
        for (const effectId of new Set(
          duplicates(effects.map((effect) => effect.id)),
        )) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["layers", nodeIndex, "effects"],
            message: `Duplicate runtime effect id: ${effectId}`,
          });
        }
        for (const modifierId of new Set(
          duplicates(modifiers.map((modifier) => modifier.id)),
        )) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["layers", nodeIndex, "modifiers"],
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
                "layers",
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
                path: ["layers", nodeIndex, "modifiers"],
                message: `Unknown runtime Path Morph target: ${modifier.from}`,
              });
            if (!toContours)
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["layers", nodeIndex, "modifiers"],
                message: `Unknown runtime Path Morph target: ${modifier.to}`,
              });
            if (fromContours && toContours) {
              const mismatch = morphTopologyMismatch(fromContours, toContours);
              if (mismatch)
                context.addIssue({
                  code: z.ZodIssueCode.custom,
                  path: ["layers", nodeIndex, "modifiers"],
                  message: mismatch,
                });
            }
          }
        } else if (
          modifiers.some((modifier) => modifier.type === "path-morph")
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["layers", nodeIndex, "modifiers"],
            message: "Runtime Path Morph modifier requires a path node",
          });
        }
        if (
          modifiers.some((modifier) => modifier.type === "trim-path") &&
          node.type !== "path"
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["layers", nodeIndex, "modifiers"],
            message: "Runtime Trim Path modifier requires a path node",
          });
        }
        if (
          modifiers.some((modifier) => modifier.type === "path-bend") &&
          node.type !== "path"
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["layers", nodeIndex, "modifiers"],
            message: "Runtime Path Bend modifier requires a path node",
          });
        }
        if (
          modifiers.filter((modifier) => modifier.type === "motion-path")
            .length > 1
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["layers", nodeIndex, "modifiers"],
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
            "layers",
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
            const target = layerById.get(modifier.targetLayerId);
            if (!target)
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...path, "targetLayerId"],
                message: `Unknown runtime constraint target: ${modifier.targetLayerId}`,
              });
            else if (modifier.targetLayerId === node.id)
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...path, "targetLayerId"],
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
          const driver = layerById.get(modifier.driverNodeId);
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
          for (const chainNodeId of modifier.chainLayerIds) {
            const chainNode = layerById.get(chainNodeId);
            if (!chainNode)
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...path, "chainLayerIds"],
                message: `Unknown runtime Secondary Motion chain node: ${chainNodeId}`,
              });
            else if (chainNode.type !== "bone")
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...path, "chainLayerIds"],
                message: `Runtime Secondary Motion chain node must be bone: ${chainNodeId}`,
              });
            const owner = secondaryChainOwners.get(chainNodeId);
            if (owner)
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...path, "chainLayerIds"],
                message: `Runtime Secondary Motion chain node already owned: ${chainNodeId}`,
              });
            else secondaryChainOwners.set(chainNodeId, modifier.id);
          }
          for (const chainNodeId of new Set(
            duplicates(modifier.chainLayerIds),
          )) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [...path, "chainLayerIds"],
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
          const source = layerById.get(modifier.pathNodeId);
          const path = [
            "layers",
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
              path: ["layers", nodeIndex, "modifiers"],
              message: "Runtime Motion Path dependency cycle detected",
            });
            break;
          }
          seen.add(motionPath.pathNodeId);
          const next = layerById.get(motionPath.pathNodeId);
          if (!next || next.type === "audio") break;
          current = next;
        }
      }
      for (
        let trackIndex = 0;
        trackIndex < runtime.tracks.length;
        trackIndex += 1
      ) {
        const track = runtime.tracks[trackIndex]!;
        const path = ["tracks", trackIndex] as Array<
          string | number
        >;
        const node = layerById.get(track.layerId);
        if (!node) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, "layerId"],
            message: `Unknown runtime node: ${track.layerId}`,
          });
          continue;
        }
        if (node.type === "audio") {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, "property"],
            message: `Animation tracks cannot target audio layers: ${track.layerId}`,
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
  });

export type MotionRuntimeProject = z.infer<typeof MotionRuntimeProjectSchema>;

/** In-memory layer graph (evaluators). Not a serialized project field. */
export type MotionRuntimeScene = RuntimeLayerGraph;
export type MotionRuntimeTrack = MotionRuntimeProject["tracks"][number];
