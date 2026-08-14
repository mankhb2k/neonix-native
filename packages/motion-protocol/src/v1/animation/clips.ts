/**
 * Motion clip lịch trình — vocabulary compiler (không thuộc JSON authoring).
 *
 * Import @motionvideo/motion-protocol/internal.
 */

import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema } from "../common";
import { ResolvableValueSchema } from "../values";
import { PropertyTrackV1Schema } from "./tracks";

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
        .array(PropertyTrackV1Schema)
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
