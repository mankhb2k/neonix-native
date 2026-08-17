/**
 * MotionRuntimeProject â€” canonical runtime IR schemas and types.
 *
 * Authoring and runtime share one layer graph: `layers` + `propertyAnimations`.
 */

import { z } from "zod";
import {
  MOTION_PROTOCOL_LIMITS,
  motionEffectPropertyCapability,
  motionPropertyCapability,
  motionPropertyValueError,
} from "../capabilities";
import { ProceduralDriverSchema } from "../v1/animation/drivers";
import { KeyframeEasingSchema } from "../v1/animation/easing";
import { AssetSchema } from "./assets";
import {
  AspectRatioSchema,
  FiniteNumberSchema,
  IdSchema,
  PercentSchema,
  PropertyPathSchema,
} from "../v1/common";

/**
 * Runtime IR format version â€” 1, matching V1 authoring.
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

// â”€â”€ Runtime IR schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { duplicates } from "./helpers";
import { LiteralValueSchema, ValueKindSchema } from "../v1/values";

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
    volume: PercentSchema.default(100),
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
        message: `trimEnd (${clip.trimEnd}) must be â‰¤ duration (${clip.duration})`,
        path: ["trimEnd"],
      });
    }
    if (clip.fadeIn + clip.fadeOut > clip.duration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `fadeIn (${clip.fadeIn}) + fadeOut (${clip.fadeOut}) must be â‰¤ duration (${clip.duration})`,
        path: ["fadeIn"],
      });
    }
  });
export type AudioClip = z.infer<typeof AudioClipSchema>;


/**
 * Runtime IR version â€” independent of the project format version.
 * Incremented when the runtime shape changes (new fields, new node types).
 * Renderers check this to reject incompatible IR.
 */
export const MOTION_RUNTIME_VERSION = 4 as const;

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

const ExtrapolationBehaviorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("clamp") }).strict(),
  z
    .object({
      type: z.literal("cycle"),
      mode: z.enum(["repeat", "pingpong"]).optional(),
    })
    .strict(),
  z.object({ type: z.literal("continue") }).strict(),
]);

/** Evaluated property animations compiled from timeline.clips — not authoring. */
const RuntimePropertyAnimationSchema = z
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
      .max(MOTION_PROTOCOL_LIMITS.keysPerPropertyAnimation),
  })
  .strict();

// â”€â”€ Runtime IR VNext â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// The runtime IR (`MotionRuntimeProject`) is the compiler's serializable
// output: composition metadata, layer graph, propertyAnimations, source refs.

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
  })
  .strict();
export type RuntimeCompositionMetadata = z.infer<
  typeof RuntimeCompositionMetadataSchema
>;

/**
 * Per-layer source ref — maps a runtime layer graph back to its authoring origin
 * (layer path or component id). Debug + error mapping only; excluded from render hashing.
 */
export const RuntimeSourceRefSchema = z
  .object({
    projectPath: z.array(z.string().min(1)).min(1).max(8),
    sourceModule: z.string().min(1).max(128).optional(),
  })
  .strict();
export type RuntimeSourceRef = z.infer<typeof RuntimeSourceRefSchema>;

/**
 * Project-level source ref index: runtime layerId → authoring origin
 * (e.g. `"layers:title"`, `"components:button@1.0.0"`).
 */
export const RuntimeSourceRefMapSchema = z
  .object({
    layers: z.record(z.string().min(1).max(256)),
  })
  .strict();
export type RuntimeSourceRefMap = z.infer<typeof RuntimeSourceRefMapSchema>;

/**
 * In-memory layer graph for evaluators (not a serialized scene).
 * Compiler lifts this onto `MotionRuntimeProject.layers` / `.propertyAnimations`.
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
      .max(MOTION_PROTOCOL_LIMITS.layersPerProject),
    propertyAnimations: z
      .array(RuntimePropertyAnimationSchema)
      .max(MOTION_PROTOCOL_LIMITS.propertyAnimationsPerProject)
      .default([]),
  })
  .strict();
export type RuntimeLayerGraph = z.infer<typeof RuntimeLayerGraphSchema>;

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
      .max(MOTION_PROTOCOL_LIMITS.layersPerProject)
      .default([]),
    propertyAnimations: z
      .array(RuntimePropertyAnimationSchema)
      .max(MOTION_PROTOCOL_LIMITS.propertyAnimationsPerProject)
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
      const effects = layerEffects(node) ?? [];
      for (const effectId of new Set(
        duplicates(effects.map((effect) => effect.id)),
      )) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["layers", nodeIndex, "effects"],
          message: `Duplicate runtime effect id: ${effectId}`,
        });
      }
      if (node.type === "path") {
        const morphTargets = node.payload.morphTargets ?? [];
        for (const targetId of new Set(
          duplicates(morphTargets.map((target) => target.id)),
        )) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["layers", nodeIndex, "payload", "morphTargets"],
            message: `Duplicate runtime Path Morph target id: ${targetId}`,
          });
        }
      }
    }
    for (
        let animationIndex = 0;
        animationIndex < runtime.propertyAnimations.length;
        animationIndex += 1
      ) {
        const animation = runtime.propertyAnimations[animationIndex]!;
        const path = ["propertyAnimations", animationIndex] as Array<
          string | number
        >;
        const node = layerById.get(animation.layerId);
        if (!node) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, "layerId"],
            message: `Unknown runtime node: ${animation.layerId}`,
          });
          continue;
        }
        if (node.type === "audio") {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, "property"],
            message: `Property animations cannot target audio layers: ${animation.layerId}`,
          });
          continue;
        }
        const effectMatch = /^effects\.([^.]+)\.(.+)$/.exec(animation.property);
        if (effectMatch) {
          const effect = layerEffects(node)?.find(
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
        const capability = motionPropertyCapability(node.type, animation.property);
        if (!capability) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, "property"],
            message: `Unsupported runtime property for ${node.type}: ${animation.property}`,
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
            message: `Property is not supported by runtime evaluator: ${animation.property}`,
          });
          continue;
        }
        for (let keyIndex = 0; keyIndex < animation.keys.length; keyIndex += 1) {
          const message = motionPropertyValueError(
            capability,
            animation.keys[keyIndex]!.v,
            animation.property,
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

type RuntimeLayerWithEffects = z.infer<typeof RuntimeLayerSchema> & {
  effects?: Array<{
    id: string;
    type: "blur" | "shadow" | "glow" | "inner-glow" | "noise" | "color-adjust";
  }>;
};

function layerEffects(
  layer: z.infer<typeof RuntimeLayerSchema>,
): RuntimeLayerWithEffects["effects"] {
  return "effects" in layer ? (layer as RuntimeLayerWithEffects).effects : undefined;
}

export type MotionRuntimeProject = z.infer<typeof MotionRuntimeProjectSchema>;

export type MotionRuntimePropertyAnimation =
  MotionRuntimeProject["propertyAnimations"][number];
