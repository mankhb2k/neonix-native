/**
 * Timeline project V3.
 *
 * Thay đổi lớn so với v2: `sceneOrder: string[]` được thay bằng
 * `visualTracks: VisualTrackV3[]` với clip chỉ nguồn scene, mang transition
 * in/out, playback rate, loop và opacity riêng. Component instance là node
 * scene (`type: "component"`), không phải nguồn visual-clip.
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
import { SceneMarkerV3Schema } from "../animation/tracks";

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

export const VisualClipSourceV3Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("scene"), sceneId: IdSchema }).strict(),
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
  })
  .strict()
  .superRefine((val, ctx) => {
    // playbackRate phải > 0 (runtime PlaybackSchema cũng enforce;
    // bắt sớm ở authoring để feedback nhanh).
    if (val.playbackRate !== undefined && !(val.playbackRate > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "playbackRate must be > 0",
        path: ["playbackRate"],
      });
    }

    // Duration transition phải nằm trong duration clip.
    const transitionInDuration = val.transitionIn?.duration ?? 0;
    const transitionOutDuration = val.transitionOut?.duration ?? 0;
    if (transitionInDuration > val.duration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `transitionIn.duration (${transitionInDuration}) must be ≤ clip.duration (${val.duration})`,
        path: ["transitionIn", "duration"],
      });
    }
    if (transitionOutDuration > val.duration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `transitionOut.duration (${transitionOutDuration}) must be ≤ clip.duration (${val.duration})`,
        path: ["transitionOut", "duration"],
      });
    }
    if (transitionInDuration + transitionOutDuration > val.duration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `transitionIn.duration (${transitionInDuration}) + transitionOut.duration (${transitionOutDuration}) must be ≤ clip.duration (${val.duration})`,
        path: ["transitionIn"],
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
    // trimEnd không được vượt duration
    if (track.trimEnd !== undefined && track.trimEnd > track.duration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `trimEnd (${track.trimEnd}) must be ≤ duration (${track.duration})`,
        path: ["trimEnd"],
      });
    }
    // fadeIn + fadeOut không được vượt duration
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
    duration: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds)
      .optional(),
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
  .strict()
  .superRefine((timeline, ctx) => {
    // Validate biên timeline: khi đã khai báo `duration`, mọi phần tử con
    // phải nằm trong khoảng đó.
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
      if (audio.start + audio.duration > duration) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `audio track "${audio.id}" ends at ${audio.start + audio.duration} beyond timeline.duration (${duration})`,
          path: ["audioTracks", audioIndex],
        });
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

export type ProjectTimelineV3 = z.infer<typeof ProjectTimelineV3Schema>;
export type VisualClipV3 = z.infer<typeof VisualClipV3Schema>;
export type VisualTrackV3 = z.infer<typeof VisualTrackV3Schema>;
export type AudioTrackV3 = z.infer<typeof AudioTrackV3Schema>;
export type CaptionTrackV3 = z.infer<typeof CaptionTrackV3Schema>;

/**
 * Schema timeline canonical — bắt buộc có `duration`.
 *
 * Authoring có thể bỏ `duration`; biên export/save phải dùng schema này để
 * độ dài MP4 cuối luôn tường minh.
 */
export const CanonicalProjectTimelineV3Schema =
  ProjectTimelineV3Schema.superRefine((timeline, ctx) => {
    if (timeline.duration === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["duration"],
        message: "Canonical timeline requires an explicit duration",
      });
    }
  });

export type CanonicalProjectTimelineV3 = ProjectTimelineV3 & {
  duration: number;
};
