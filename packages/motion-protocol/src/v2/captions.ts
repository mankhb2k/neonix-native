import { z } from "zod";
import { MOTION_V2_LIMITS } from "../capabilities";
import { FiniteNumberSchema, IdSchema, LocaleIdentifierSchema } from "./common";

const CaptionTokenSchema = z
  .object({
    id: IdSchema,
    text: z.string().min(1),
    start: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds),
    end: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds),
    speakerId: IdSchema.optional(),
    confidence: FiniteNumberSchema.min(0).max(1).optional(),
  })
  .strict()
  .superRefine((token, context) => {
    if (token.end <= token.start) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end"],
        message: "Caption token end must be > start",
      });
    }
  });

const CaptionSegmentationSchema = z
  .object({
    maxLines: FiniteNumberSchema.int().positive().max(8).default(2),
    maxWordsPerCue: FiniteNumberSchema.int().positive().max(64).optional(),
    maxCharactersPerLine: FiniteNumberSchema.int().positive().max(256).optional(),
    minCueDuration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds).optional(),
    maxCueDuration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds).optional(),
    gapThreshold: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds).optional(),
  })
  .strict();

const CaptionStyleSchema = z
  .object({
    fontAssetId: IdSchema.optional(),
    fontSize: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.nodeDimension),
    fontWeight: FiniteNumberSchema.int().min(1).max(1000).optional(),
    fill: z.string().min(1),
    stroke: z.string().min(1).optional(),
    strokeWidth: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension).optional(),
    safeArea: z.enum(["tiktok", "reels", "youtube", "generic"]).default("generic"),
    position: z.enum(["top", "center", "bottom"]).default("bottom"),
    inactiveWord: z
      .object({
        fill: z.string().min(1).optional(),
        fontWeight: FiniteNumberSchema.int().min(1).max(1000).optional(),
      })
      .strict()
      .optional(),
    activeWord: z
      .object({
        fill: z.string().min(1).optional(),
        fontWeight: FiniteNumberSchema.int().min(1).max(1000).optional(),
      })
      .strict()
      .optional(),
    box: z
      .object({
        fill: z.string().min(1),
        paddingX: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension),
        paddingY: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension),
        radius: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const CaptionAnimationSchema = z
  .object({
    presetId: z.enum(["none", "word-pop", "karaoke", "active-highlight", "bounce"]).default("none"),
    params: z.record(z.string(), FiniteNumberSchema).optional(),
  })
  .strict();

export const CaptionTrackSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).optional(),
    audioTrackId: IdSchema.optional(),
    locale: LocaleIdentifierSchema,
    enabled: z.boolean().default(true),
    tokens: z.array(CaptionTokenSchema).max(MOTION_V2_LIMITS.captionTokensPerTrack),
    segmentation: CaptionSegmentationSchema.default({ maxLines: 2 }),
    style: CaptionStyleSchema,
    animation: CaptionAnimationSchema.default({ presetId: "none" }),
  })
  .strict()
  .superRefine((track, context) => {
    const seen = new Set<string>();
    let prevEnd = -Infinity;
    for (let i = 0; i < track.tokens.length; i += 1) {
      const token = track.tokens[i]!;
      if (seen.has(token.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tokens", i, "id"],
          message: `Duplicate caption token id: ${token.id}`,
        });
      }
      seen.add(token.id);
      if (token.start < prevEnd - 1e-9) {
        const prev = track.tokens[i - 1];
        if (!prev || prev.speakerId === token.speakerId) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["tokens", i, "start"],
            message: "Caption tokens must be sorted and non-overlapping for the same speaker",
          });
        }
      }
      prevEnd = Math.max(prevEnd, token.end);
    }
  });

export type CaptionTrack = z.infer<typeof CaptionTrackSchema>;
export type CaptionToken = z.infer<typeof CaptionTokenSchema>;
