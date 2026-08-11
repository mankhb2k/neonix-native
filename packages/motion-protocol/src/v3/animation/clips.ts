/**
 * V3 scene-local motion clips.
 *
 * Same scheduling vocabulary (`absolute` | `scene-end` | `after` |
 * `with`) with preset / property-track sources. Component-action sources
 * are dropped: components are timeline-level visual clips in v3.
 */

import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema } from "../common";
import { ResolvableValueSchema } from "../values";
import { PropertyTrackV3Schema } from "./tracks";

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
      kind: z.literal("scene-end"),
      /** 0 = clip ends at scene end; negative = pad before end. */
      offset: FiniteNumberSchema.max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds),
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

// ── V3 clip source (no component-action) ──────────────────────────────

export const ClipSourceV3Schema = z.discriminatedUnion("kind", [
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
        .array(PropertyTrackV3Schema)
        .min(1)
        .max(MOTION_PROTOCOL_LIMITS.tracksPerClip),
    })
    .strict(),
]);

// ── V3 motion clip ────────────────────────────────────────────────────

export const MotionClipV3Schema = z
  .object({
    id: IdSchema,
    targetId: IdSchema.optional(),
    schedule: ClipScheduleSchema,
    duration: z
      .number()
      .positive()
      .finite()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds),
    playback: PlaybackSchema.default({}),
    source: ClipSourceV3Schema,
  })
  .strict();

// ── V3 aliases ────────────────────────────────────────────────────────

export const ScheduleV3Schema = ClipScheduleSchema;
export const PlaybackV3Schema = PlaybackSchema;

export type MotionClipV3 = z.infer<typeof MotionClipV3Schema>;
export type ScheduleV3 = z.infer<typeof ScheduleV3Schema>;
export type ClipSourceV3 = z.infer<typeof ClipSourceV3Schema>;
