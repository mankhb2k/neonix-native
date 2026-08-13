/**
 * Timeline project V1 — AE visual layer stack + audio DSP fades.
 *
 * Track `order` is a sparse integer ordering key (not contiguous).
 * - Visual tracks: order >= 0 (render stack; lower draws under)
 * - Audio tracks: order < 0 (listing/mix ordering only; not a visual stack)
 * - All track order values in one project must be unique across visual+audio
 *
 * Visual: time-exclusive lanes; no role, no transitionIn/Out. Clip source is
 * scene-only; components live as scene layers (`type: "component"`).
 *
 * Audio: tracks hold clips[]; fadeIn/fadeOut are per-clip playback envelopes
 * (not transitions between clips). Same-track overlap is allowed (mix).
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { CaptionTrackSchema } from "../captions";
import {
  FiniteNumberSchema,
  IdSchema,
  NormalizedRatioSchema,
  PositiveNumberSchema,
} from "../common";
import { SceneMarkerV1Schema } from "../animation/tracks";

export const VisualClipSourceV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("scene"), sceneId: IdSchema }).strict(),
]);

export const VisualClipV1Schema = z
  .object({
    id: IdSchema,
    source: VisualClipSourceV1Schema,
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
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.playbackRate !== undefined && !(val.playbackRate > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "playbackRate must be > 0",
        path: ["playbackRate"],
      });
    }
  });

export const VisualTrackV1Schema = z
  .object({
    id: IdSchema,
    /** Sparse ordering key; must be >= 0. Unique across all timeline tracks. */
    order: z.number().int().nonnegative(),
    muted: z.boolean().default(false),
    clips: z
      .array(VisualClipV1Schema)
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.scenesPerProject),
  })
  .strict();

export const AudioClipV1Schema = z
  .object({
    id: IdSchema,
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

export const AudioTrackV1Schema = z
  .object({
    id: IdSchema,
    /** Sparse ordering key; must be < 0. Unique across all timeline tracks. */
    order: z.number().int().negative(),
    muted: z.boolean().default(false),
    clips: z
      .array(AudioClipV1Schema)
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.scenesPerProject),
  })
  .strict();

export const CaptionTrackV1Schema = CaptionTrackSchema;

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

export const ProjectTimelineV1Schema = z
  .object({
    duration: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds)
      .optional(),
    workArea: WorkAreaSchema.optional(),
    markers: z.array(SceneMarkerV1Schema).max(256).optional(),
    visualTracks: z
      .array(VisualTrackV1Schema)
      .max(MOTION_PROTOCOL_LIMITS.visualTracksPerProject),
    audioTracks: z
      .array(AudioTrackV1Schema)
      .max(MOTION_PROTOCOL_LIMITS.audioTracksPerProject)
      .default([]),
    captionTracks: z
      .array(CaptionTrackV1Schema)
      .max(MOTION_PROTOCOL_LIMITS.captionTracksPerProject)
      .default([]),
  })
  .strict()
  .superRefine((timeline, ctx) => {
    const duration = timeline.duration;
    if (duration === undefined) return;

    if (timeline.workArea && timeline.workArea.end > duration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `workArea.end (${timeline.workArea.end}) must be ≤ timeline.duration (${duration})`,
        path: ["workArea", "end"],
      });
    }

    for (const [markerIndex, marker] of (timeline.markers ?? []).entries()) {
      if (marker.t > duration) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `marker "${marker.id}" t (${marker.t}) must be ≤ timeline.duration (${duration})`,
          path: ["markers", markerIndex, "t"],
        });
      }
    }

    for (const [trackIndex, track] of timeline.visualTracks.entries()) {
      for (const [clipIndex, clip] of track.clips.entries()) {
        if (clip.start + clip.duration > duration) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `clip "${clip.id}" ends at ${clip.start + clip.duration} beyond timeline.duration (${duration})`,
            path: ["visualTracks", trackIndex, "clips", clipIndex],
          });
        }
      }
    }

    for (const [audioIndex, audio] of timeline.audioTracks.entries()) {
      for (const [clipIndex, clip] of audio.clips.entries()) {
        if (clip.start + clip.duration > duration) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `audio clip "${clip.id}" ends at ${clip.start + clip.duration} beyond timeline.duration (${duration})`,
            path: ["audioTracks", audioIndex, "clips", clipIndex],
          });
        }
      }
    }

    for (const [captionIndex, caption] of timeline.captionTracks.entries()) {
      for (const [tokenIndex, token] of caption.tokens.entries()) {
        if (token.end > duration) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `caption token "${token.id}" ends at ${token.end} beyond timeline.duration (${duration})`,
            path: ["captionTracks", captionIndex, "tokens", tokenIndex, "end"],
          });
        }
      }
    }
  });

export type ProjectTimelineV1 = z.infer<typeof ProjectTimelineV1Schema>;
export type VisualClipSourceV1 = z.infer<typeof VisualClipSourceV1Schema>;
export type VisualClipV1 = z.infer<typeof VisualClipV1Schema>;
export type VisualTrackV1 = z.infer<typeof VisualTrackV1Schema>;
export type AudioClipV1 = z.infer<typeof AudioClipV1Schema>;
export type AudioTrackV1 = z.infer<typeof AudioTrackV1Schema>;
export type CaptionTrackV1 = z.infer<typeof CaptionTrackV1Schema>;

/**
 * Schema timeline canonical — bắt buộc có `duration`.
 */
export const CanonicalProjectTimelineV1Schema =
  ProjectTimelineV1Schema.superRefine((timeline, ctx) => {
    if (timeline.duration === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["duration"],
        message: "Canonical timeline requires an explicit duration",
      });
    }
  });

export type CanonicalProjectTimelineV1 = ProjectTimelineV1 & {
  duration: number;
};
