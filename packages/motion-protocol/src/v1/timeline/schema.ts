/**
 * Timeline project V1 — global metadata only.
 *
 * Duration, work area, and markers live here. Visual / audio / caption
 * content lives on `project.layers` (root layer = timeline lane).
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, PositiveNumberSchema } from "../common";
import { SceneMarkerV1Schema } from "../animation/tracks";

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
