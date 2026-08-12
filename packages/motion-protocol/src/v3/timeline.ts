/**
 * V3 project timeline.
 *
 * Biggest change from v2: `sceneOrder: string[]` is replaced by
 * `visualTracks: VisualTrackV3[]` with clips that reference scenes or
 * components and carry their own in/out transitions, playback rate, loop
 * and opacity.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import { CaptionTrackSchema } from "./captions";
import {
  FiniteNumberSchema,
  IdSchema,
  NormalizedRatioSchema,
  PositiveNumberSchema,
} from "./common";
import { VariableReferenceSchema } from "./values";
import { KeyframeEasingSchema } from "./animation/easing";
import {
  ExtrapolationBehaviorSchema,
  SceneMarkerV3Schema,
  TrackTimeSchema,
} from "./animation/tracks";

export const TransitionV3Schema = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("cut"), duration: z.literal(0).optional() })
    .strict(),
  z
    .object({
      type: z.literal("fade"),
      duration: PositiveNumberSchema.max(
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
      duration: PositiveNumberSchema.max(
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
      duration: PositiveNumberSchema.max(
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
      duration: PositiveNumberSchema.max(
        MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
      ),
      direction: z.enum(["left", "right", "up", "down"]),
      softness: NormalizedRatioSchema.optional(),
      easing: z
        .enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"])
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("zoom"),
      duration: PositiveNumberSchema.max(
        MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
      ),
      direction: z.enum(["in", "out"]),
      easing: z
        .enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"])
        .optional(),
    })
    .strict(),
]);

export type TransitionV3 = z.infer<typeof TransitionV3Schema>;

/**
 * Component instance transform — allows consumers to position, scale, rotate,
 * and keyframe the entire component as a group layer without touching internals.
 *
 * All fields are optional; missing fields default to identity values.
 * Only meaningful when `VisualClipV3.source.kind === "component"`.
 */
export const ComponentInstanceTransformV3Schema = z
  .object({
    x: FiniteNumberSchema,
    y: FiniteNumberSchema,
    rotation: FiniteNumberSchema,
    scaleX: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.transformScale,
    ),
    scaleY: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.transformScale,
    ),
    anchorX: FiniteNumberSchema.min(0).max(1),
    anchorY: FiniteNumberSchema.min(0).max(1),
    opacity: FiniteNumberSchema.min(0).max(1),
    visible: z.boolean(),
    flipX: z.boolean(),
    flipY: z.boolean(),
  })
  .partial()
  .strict()
  .superRefine((val, ctx) => {
    if (Object.keys(val).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "instanceTransform must have at least one property — empty object is not valid",
        path: [],
      });
    }
  });

export type ComponentInstanceTransformV3 = z.infer<
  typeof ComponentInstanceTransformV3Schema
>;

// ── Instance transform track (component-instance motion) ──────────

/**
 * Allowed property paths for `instanceTransformTracks`.
 *
 * Only group-level transform properties are permitted because
 * instanceTransformTracks animate the synthetic wrapper group, not
 * individual nodes inside the component.
 */
export const INSTANCE_TRANSFORM_ALLOWED_PROPERTIES = [
  "transform.x",
  "transform.y",
  "transform.rotation",
  "transform.scaleX",
  "transform.scaleY",
  "transform.opacity",
  "transform.anchorX",
  "transform.anchorY",
  "transform.visible",
  "transform.flipX",
  "transform.flipY",
] as const;

/**
 * A single keyframe track that animates a component-instance wrapper group.
 *
 * Unlike `PropertyTrackV3Schema`, this schema:
 * - Has **no `targetId`** — the target is always the synthetic wrapper group
 *   created by the compiler (e.g. `"<clipId>__instance"`).
 * - Restricts `property` to group-level transform paths only.
 * - Guards `valueKind` so it matches the property type (e.g. transform.x
 *   requires "number", not "color").
 */

const NumberInstanceValueSchema = z.union([
  FiniteNumberSchema,
  VariableReferenceSchema,
]);
const RatioInstanceValueSchema = z.union([
  FiniteNumberSchema.min(0).max(1),
  VariableReferenceSchema,
]);
const ScaleInstanceValueSchema = z.union([
  FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.transformScale),
  VariableReferenceSchema,
]);
const BooleanInstanceValueSchema = z.union([
  z.boolean(),
  VariableReferenceSchema,
]);

function createInstanceTransformTrackSchema<
  TProperty extends (typeof INSTANCE_TRANSFORM_ALLOWED_PROPERTIES)[number],
>(
  property: TProperty,
  valueKind: z.ZodTypeAny,
  valueSchema: z.ZodTypeAny,
) {
  return z
    .object({
      property: z.literal(property),
      valueKind: valueKind.optional(),
      preBehavior: ExtrapolationBehaviorSchema.optional(),
      postBehavior: ExtrapolationBehaviorSchema.optional(),
      keys: z
        .array(
          z
            .object({
              t: TrackTimeSchema,
              v: valueSchema,
              easing: KeyframeEasingSchema.optional(),
            })
            .strict(),
        )
        .min(1)
        .max(MOTION_PROTOCOL_LIMITS.keysPerTrack),
    })
    .strict();
}

export const InstanceTransformTrackV3Schema = z.discriminatedUnion("property", [
  createInstanceTransformTrackSchema(
    "transform.x",
    z.literal("number"),
    NumberInstanceValueSchema,
  ),
  createInstanceTransformTrackSchema(
    "transform.y",
    z.literal("number"),
    NumberInstanceValueSchema,
  ),
  createInstanceTransformTrackSchema(
    "transform.rotation",
    z.enum(["number", "angle"]),
    NumberInstanceValueSchema,
  ),
  createInstanceTransformTrackSchema(
    "transform.scaleX",
    z.literal("number"),
    ScaleInstanceValueSchema,
  ),
  createInstanceTransformTrackSchema(
    "transform.scaleY",
    z.literal("number"),
    ScaleInstanceValueSchema,
  ),
  createInstanceTransformTrackSchema(
    "transform.opacity",
    z.literal("number"),
    RatioInstanceValueSchema,
  ),
  createInstanceTransformTrackSchema(
    "transform.anchorX",
    z.literal("number"),
    RatioInstanceValueSchema,
  ),
  createInstanceTransformTrackSchema(
    "transform.anchorY",
    z.literal("number"),
    RatioInstanceValueSchema,
  ),
  createInstanceTransformTrackSchema(
    "transform.visible",
    z.literal("boolean"),
    BooleanInstanceValueSchema,
  ),
  createInstanceTransformTrackSchema(
    "transform.flipX",
    z.literal("boolean"),
    BooleanInstanceValueSchema,
  ),
  createInstanceTransformTrackSchema(
    "transform.flipY",
    z.literal("boolean"),
    BooleanInstanceValueSchema,
  ),
]);

export type InstanceTransformTrackV3 = z.infer<
  typeof InstanceTransformTrackV3Schema
>;

export const VisualClipSourceV3Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("scene"), sceneId: IdSchema }).strict(),
  z.object({ kind: z.literal("component"), componentId: IdSchema }).strict(),
]);

export const VisualClipV3Schema = z
  .object({
    id: IdSchema,
    source: VisualClipSourceV3Schema,
    start: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    duration: PositiveNumberSchema.max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    trimStart: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds)
      .optional(),
    playbackRate: PositiveNumberSchema.max(
      MOTION_PROTOCOL_LIMITS.transformScale,
    ).optional(),
    loop: z.boolean().default(false),
    opacity: NormalizedRatioSchema.default(1),
    transitionIn: TransitionV3Schema.optional(),
    transitionOut: TransitionV3Schema.optional(),
    /** Static placement transform for the entire component instance. Only meaningful when `source.kind === "component"`. */
    instanceTransform: ComponentInstanceTransformV3Schema.optional(),
    /** Keyframe tracks that animate the component instance wrapper group over time. Only meaningful when `source.kind === "component"`. */
    instanceTransformTracks: z
      .array(InstanceTransformTrackV3Schema)
      .max(MOTION_PROTOCOL_LIMITS.tracksPerClip)
      .optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.source.kind !== "component") {
      if (val.instanceTransform) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'instanceTransform is only valid for component-source clips (source.kind === "component")',
          path: ["instanceTransform"],
        });
      }
      if (val.instanceTransformTracks !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'instanceTransformTracks is only valid for component-source clips (source.kind === "component")',
          path: ["instanceTransformTracks"],
        });
      }
    }
    // playbackRate must be > 0 (runtime PlaybackSchema already enforces this;
    // catch it at authoring time too for early feedback).
    if (val.playbackRate !== undefined && !(val.playbackRate > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "playbackRate must be > 0",
        path: ["playbackRate"],
      });
    }
  });

export const VisualTrackV3Schema = z
  .object({
    id: IdSchema,
    role: z.enum(["main", "overlay"]),
    order: z.number().int().nonnegative(),
    muted: z.boolean().default(false),
    clips: z
      .array(VisualClipV3Schema)
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.scenesPerProject),
  })
  .strict();

export const AudioTrackV3Schema = z
  .object({
    id: IdSchema,
    role: z.enum(["bgm", "voiceover", "sfx"]),
    assetId: IdSchema,
    start: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    duration: PositiveNumberSchema.max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    trimStart: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds)
      .default(0),
    trimEnd: PositiveNumberSchema.max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ).optional(),
    playbackRate: PositiveNumberSchema.max(
      MOTION_PROTOCOL_LIMITS.transformScale,
    ).default(1),
    volume: NormalizedRatioSchema.default(1),
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
  .superRefine((track, ctx) => {
    // trimEnd must not exceed duration
    if (track.trimEnd !== undefined && track.trimEnd > track.duration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `trimEnd (${track.trimEnd}) must be ≤ duration (${track.duration})`,
        path: ["trimEnd"],
      });
    }
    // fadeIn + fadeOut must not exceed duration
    if (track.fadeIn + track.fadeOut > track.duration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `fadeIn (${track.fadeIn}) + fadeOut (${track.fadeOut}) must be ≤ duration (${track.duration})`,
        path: ["fadeIn"],
      });
    }
  });

export const CaptionTrackV3Schema = CaptionTrackSchema;

export const WorkAreaSchema = z
  .object({
    start: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    end: PositiveNumberSchema.max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds),
  })
  .strict()
  .superRefine((workArea, context) => {
    if (workArea.end <= workArea.start) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end"],
        message: "WorkArea end must be > start",
      });
    }
  });

export const ProjectTimelineV3Schema = z
  .object({
    duration: PositiveNumberSchema.max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ).optional(),
    workArea: WorkAreaSchema.optional(),
    markers: z.array(SceneMarkerV3Schema).max(256).optional(),
    visualTracks: z
      .array(VisualTrackV3Schema)
      .max(MOTION_PROTOCOL_LIMITS.visualTracksPerProject),
    audioTracks: z
      .array(AudioTrackV3Schema)
      .max(MOTION_PROTOCOL_LIMITS.audioTracksPerProject)
      .default([]),
    captionTracks: z
      .array(CaptionTrackV3Schema)
      .max(MOTION_PROTOCOL_LIMITS.captionTracksPerProject)
      .default([]),
  })
  .strict();

export type ProjectTimelineV3 = z.infer<typeof ProjectTimelineV3Schema>;
export type VisualClipV3 = z.infer<typeof VisualClipV3Schema>;
export type VisualTrackV3 = z.infer<typeof VisualTrackV3Schema>;
export type AudioTrackV3 = z.infer<typeof AudioTrackV3Schema>;
export type CaptionTrackV3 = z.infer<typeof CaptionTrackV3Schema>;
