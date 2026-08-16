/**
 * Motion clip lịch trình — vocabulary compiler (không thuộc JSON authoring).
 * Authoring layer/property animation: `timeline.clips` (src/v1/timeline/clips.ts).
 *
 * Import @motionvideo/motion-protocol/internal.
 */

import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema, PropertyPathSchema } from "../common";
import { ResolvableValueSchema, ValueKindSchema } from "../values";
import { KeyframeEasingSchema } from "./easing";

// ── Shared sub-schemas (canonical) ────────────────────────────────────

export const ClipScheduleSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("absolute"),
      at: FiniteNumberSchema.nonnegative().max(
        MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
      ),
    })
    .strict(),
  z
    .object({
      kind: z.literal("timeline-end"),
      /** 0 = ends at timeline/graph end; negative = pad before end. */
      offset: FiniteNumberSchema.max(
        MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
      ),
    })
    .strict(),
  z
    .object({
      kind: z.literal("after"),
      clipId: IdSchema,
      offset: FiniteNumberSchema.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("with"),
      clipId: IdSchema,
      offset: FiniteNumberSchema.optional(),
    })
    .strict(),
]);

export const PlaybackSchema = z
  .object({
    iterations: z
      .union([
        FiniteNumberSchema.int()
          .positive()
          .max(MOTION_PROTOCOL_LIMITS.playbackIterations),
        z.literal("infinite"),
      ])
      .default(1),
    direction: z.enum(["normal", "reverse", "alternate"]).default("normal"),
    rate: ResolvableValueSchema.default(1),
  })
  .strict()
  .superRefine((playback, context) => {
    if (typeof playback.rate === "number" && !(playback.rate > 0)) {
      context.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: Number.MIN_VALUE,
        inclusive: false,
        type: "number",
        path: ["rate"],
        message: "Number must be greater than 0",
      });
    }
  });

export const ExtrapolationBehaviorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("clamp") }).strict(),
  z
    .object({
      type: z.literal("cycle"),
      mode: z.enum(["repeat", "pingpong"]).optional(),
    })
    .strict(),
  z.object({ type: z.literal("continue") }).strict(),
]);

const VALUE_KIND_BY_PROPERTY: Record<string, string[]> = {
  "transform.translate.x": ["number", "angle"],
  "transform.translate.y": ["number", "angle"],
  "transform.rotate.z": ["number", "angle"],
  "transform.scale.x": ["number"],
  "transform.scale.y": ["number"],
  "transform.skew.x": ["number", "angle"],
  "transform.skew.y": ["number", "angle"],
  "transform.depth": ["number"],
  "appearance.opacity": ["number"],
  "style.fill": ["color"],
  "style.stroke": ["color"],
  "style.strokeWidth": ["number"],
  "payload.color": ["color"],
  "payload.fontSize": ["number"],
};

const ClipKeyTimeSchema = z.union([
  FiniteNumberSchema.nonnegative().max(
    MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
  ),
  z
    .object({
      markerId: IdSchema,
      offset: FiniteNumberSchema.default(0),
    })
    .strict(),
]);

const InternalClipPropertyAnimationSchema = z
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
            t: ClipKeyTimeSchema,
            v: ResolvableValueSchema,
            easing: KeyframeEasingSchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.keysPerTrack),
  })
  .strict()
  .superRefine((track, ctx) => {
    if (!track.valueKind) return;
    const allowed = VALUE_KIND_BY_PROPERTY[track.property];
    if (allowed && !allowed.includes(track.valueKind)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `valueKind "${track.valueKind}" is incompatible with property "${track.property}". Allowed: ${allowed.join(", ")}`,
        path: ["valueKind"],
      });
    }
  });

// ── V1 clip source ────────────────────────────────────────────────────

export const ClipSourceV1Schema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("preset"),
      presetId: IdSchema,
      params: z.record(z.unknown()).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("tracks"),
      tracks: z
        .array(InternalClipPropertyAnimationSchema)
        .min(1)
        .max(MOTION_PROTOCOL_LIMITS.tracksPerClip),
    })
    .strict(),
]);

// ── V1 motion clip ────────────────────────────────────────────────────

export const MotionClipV1Schema = z
  .object({
    id: IdSchema,
    layerId: IdSchema.optional(),
    schedule: ClipScheduleSchema,
    duration: z
      .number()
      .positive()
      .finite()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds),
    playback: PlaybackSchema.default({}),
    source: ClipSourceV1Schema,
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.source.kind === "preset" && !val.layerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "layerId is required when source.kind is 'preset'",
        path: ["layerId"],
      });
    }
  });

// ── V1 aliases ────────────────────────────────────────────────────────

export const ScheduleV1Schema = ClipScheduleSchema;
export const PlaybackV1Schema = PlaybackSchema;

export type MotionClipV1 = z.infer<typeof MotionClipV1Schema>;
export type LayerMotionUnit = MotionClipV1;
export const LayerMotionUnitSchema = MotionClipV1Schema;
export type ScheduleV1 = z.infer<typeof ScheduleV1Schema>;
export type ClipSourceV1 = z.infer<typeof ClipSourceV1Schema>;
