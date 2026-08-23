import { z } from "zod";
import {
  V2FiniteNumberSchema,
  V2IdSchema,
  V2NonNegativeNumberSchema,
  V2PositiveNumberSchema,
} from "./common";

export const V2AudioFadeCurveSchema = z.enum(["linear", "equal-power"]);

export const V2AudioFadeSchema = z
  .object({
    duration: V2PositiveNumberSchema,
    curve: V2AudioFadeCurveSchema,
  })
  .strict();

export const V2AudioClipSchema = z
  .object({
    id: V2IdSchema,
    assetId: V2IdSchema,
    timing: z
      .object({
        start: V2NonNegativeNumberSchema,
        duration: V2PositiveNumberSchema,
      })
      .strict(),
    trim: z
      .object({
        start: V2NonNegativeNumberSchema,
        end: V2PositiveNumberSchema.optional(),
      })
      .strict(),
    playbackRate: V2PositiveNumberSchema,
    loop: z.boolean(),
    gainDb: V2FiniteNumberSchema,
    fadeIn: V2AudioFadeSchema.optional(),
    fadeOut: V2AudioFadeSchema.optional(),
  })
  .strict()
  .superRefine((clip, ctx) => {
    if (clip.trim.end !== undefined && clip.trim.end <= clip.trim.start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Audio trim end must be greater than trim start",
        path: ["trim", "end"],
      });
    }
    for (const [field, fade] of [
      ["fadeIn", clip.fadeIn],
      ["fadeOut", clip.fadeOut],
    ] as const) {
      if (fade && fade.duration > clip.timing.duration) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Audio ${field} duration cannot exceed clip duration`,
          path: [field, "duration"],
        });
      }
    }
  });

export const V2AudioTrackSchema = z
  .object({
    id: V2IdSchema,
    gainDb: V2FiniteNumberSchema,
    pan: V2FiniteNumberSchema.min(-1).max(1),
    muted: z.boolean(),
    clips: z.array(V2AudioClipSchema),
  })
  .strict();

export const V2AudioDomainSchema = z
  .object({
    sampleRate: z.literal(48000),
    tracks: z.array(V2AudioTrackSchema),
  })
  .strict();

export type V2AudioFadeCurve = z.infer<typeof V2AudioFadeCurveSchema>;
export type V2AudioFade = z.infer<typeof V2AudioFadeSchema>;
export type V2AudioClip = z.infer<typeof V2AudioClipSchema>;
export type V2AudioTrack = z.infer<typeof V2AudioTrackSchema>;
export type V2AudioDomain = z.infer<typeof V2AudioDomainSchema>;
