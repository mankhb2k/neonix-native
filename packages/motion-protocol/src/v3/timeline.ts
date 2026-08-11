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
import { SceneMarkerV3Schema } from "./animation/tracks";

export const TransitionV3Schema = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("cut"), duration: z.literal(0).optional() })
    .strict(),
  z
    .object({
      type: z.literal("fade"),
      duration: PositiveNumberSchema.max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds),
      color: z.string().min(1).optional(),
      easing: z
        .enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"])
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("crossfade"),
      duration: PositiveNumberSchema.max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds),
      easing: z
        .enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"])
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("slide"),
      duration: PositiveNumberSchema.max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds),
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
      duration: PositiveNumberSchema.max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds),
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
      duration: PositiveNumberSchema.max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds),
      direction: z.enum(["in", "out"]),
      easing: z
        .enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"])
        .optional(),
    })
    .strict(),
]);

export type TransitionV3 = z.infer<typeof TransitionV3Schema>;

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
    duration: PositiveNumberSchema.max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds),
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
  })
  .strict();

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
    duration: PositiveNumberSchema.max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds),
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
  .strict();

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
      .max(MOTION_PROTOCOL_LIMITS.audioTracksPerProject),
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
