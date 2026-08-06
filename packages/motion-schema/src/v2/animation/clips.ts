import { z } from "zod";
import { MOTION_V2_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema } from "../common";
import { ResolvableValueSchema } from "../values";
import { PropertyTrackSchema } from "./tracks";

export const ClipScheduleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("absolute"), at: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds) }).strict(),
  z.object({ kind: z.literal("after"), clipId: IdSchema, offset: FiniteNumberSchema.optional() }).strict(),
  z.object({ kind: z.literal("with"), clipId: IdSchema, offset: FiniteNumberSchema.optional() }).strict(),
]);

export const PlaybackSchema = z
  .object({
    iterations: z.union([FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.playbackIterations), z.literal("infinite")]).default(1),
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

export const ClipSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("preset"), presetId: IdSchema, params: z.record(ResolvableValueSchema).optional() })
    .strict(),
  z.object({ kind: z.literal("tracks"), tracks: z.array(PropertyTrackSchema).min(1).max(MOTION_V2_LIMITS.tracksPerClip) }).strict(),
  z.object({
    kind: z.literal("component-action"),
    actionId: IdSchema,
    params: z.record(ResolvableValueSchema).optional(),
  }).strict(),
]);

export const ClipV2Schema = z
  .object({
    id: IdSchema,
    targetId: IdSchema.optional(),
    schedule: ClipScheduleSchema,
    duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
    playback: PlaybackSchema.default({}),
    source: ClipSourceSchema,
  })
  .strict();

export type MotionClip = z.infer<typeof ClipV2Schema>;
