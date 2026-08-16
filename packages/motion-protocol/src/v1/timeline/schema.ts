/**
 * Timeline project — duration, workArea, clips.
 *
 * Nội dung visual/audio sống trên project.layers.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, PositiveNumberSchema } from "../common";
import { TimelinePropertyClipV1Schema } from "./clips";

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
    clips: z
      .array(TimelinePropertyClipV1Schema)
      .max(MOTION_PROTOCOL_LIMITS.motionClipsPerProject)
      .optional(),
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
  });

export type ProjectTimelineV1 = z.infer<typeof ProjectTimelineV1Schema>;

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
