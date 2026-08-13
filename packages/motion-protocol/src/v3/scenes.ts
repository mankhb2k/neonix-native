/**
 * V3 scene definitions.
 *
 * Scenes do NOT carry timeline transition fields. Visual effects are
 * scene/component node animation. Scene-local motion clips remain as `clips`.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import { MotionBlurSettingsSchema } from "./layers/structural";
import { IdSchema, SemanticSchema } from "./common";
import { MotionClipV3Schema } from "./animation/clips";
import { ProceduralDriverSchema } from "./animation/drivers";
import { SceneMarkerV3Schema } from "./animation/tracks";
import { LayerV3Schema } from "./layers";

export const SceneDefinitionV3Schema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).optional(),
    duration: z
      .number()
      .positive()
      .finite()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds),
    semantic: SemanticSchema.optional(),
    space: z.enum(["flat-2d", "layered-2.5d"]).default("flat-2d"),
    markers: z.array(SceneMarkerV3Schema).max(256).optional(),
    motionBlur: MotionBlurSettingsSchema.optional(),
    drivers: z.array(ProceduralDriverSchema).max(512).optional(),
    layers: z
      .array(LayerV3Schema)
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.layersPerScene),
    clips: z
      .array(MotionClipV3Schema)
      .max(MOTION_PROTOCOL_LIMITS.clipsPerScene)
      .default([]),
    activeCameraLayerId: IdSchema.optional(),
  })
  .strict()
  .superRefine((scene, context) => {
    // Scene-local motion clip bounds — validate schedules that can be
    // resolved statically. `after`/`with` chains are resolved (and cycle-
    // checked) by the compiler, not here.
    for (const [clipIndex, clip] of scene.clips.entries()) {
      const schedule = clip.schedule;
      if (schedule.kind === "absolute") {
        const end = schedule.at + clip.duration;
        if (end > scene.duration) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["clips", clipIndex, "schedule"],
            message: `clip "${clip.id}" ends at ${end} beyond scene.duration (${scene.duration})`,
          });
        }
      } else if (schedule.kind === "scene-end" && schedule.offset <= 0) {
        // offset 0 = clip ends at scene end; negative = pad before end.
        // start = scene.duration + offset - duration must be ≥ 0.
        const start = scene.duration + schedule.offset - clip.duration;
        if (start < 0) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["clips", clipIndex, "schedule"],
            message: `clip "${clip.id}" (duration ${clip.duration}) would start before 0 with scene-end offset ${schedule.offset} and scene.duration ${scene.duration}`,
          });
        }
      }
    }

    if (scene.activeCameraLayerId === undefined) return;
    const camera = scene.layers.find((node) => node.id === scene.activeCameraLayerId);
    if (!camera) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activeCameraLayerId"],
        message: `activeCameraLayerId "${scene.activeCameraLayerId}" does not reference a node in this scene`,
      });
      return;
    }
    if (camera.type !== "camera") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activeCameraLayerId"],
        message: `activeCameraLayerId "${scene.activeCameraLayerId}" must reference a camera node`,
      });
    }
  });

export type SceneDefinitionV3 = z.infer<typeof SceneDefinitionV3Schema>;
