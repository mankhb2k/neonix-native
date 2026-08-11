/**
 * V3 scene definitions.
 *
 * Key difference from v2: scenes do NOT carry a `transition` — transitions
 * live on timeline visual clips (`transitionOut`). Scenes also no longer
 * hold a `clips` array at the scene level in the timeline sense; scene-local
 * motion clips remain available as `clips`.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import { MotionBlurSettingsSchema } from "./nodes/structural";
import { IdSchema, SemanticSchema } from "./common";
import { MotionClipV3Schema } from "./animation/clips";
import { ProceduralDriverSchema } from "./animation/drivers";
import { SceneMarkerV3Schema } from "./animation/tracks";
import { NodeV3Schema } from "./nodes";

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
    nodes: z.array(NodeV3Schema).max(MOTION_PROTOCOL_LIMITS.nodesPerScene),
    clips: z
      .array(MotionClipV3Schema)
      .max(MOTION_PROTOCOL_LIMITS.clipsPerScene)
      .default([]),
    activeCameraId: IdSchema.optional(),
  })
  .strict()
  .superRefine((scene, context) => {
    if (scene.activeCameraId === undefined) return;
    const camera = scene.nodes.find((node) => node.id === scene.activeCameraId);
    if (!camera) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activeCameraId"],
        message: `activeCameraId "${scene.activeCameraId}" does not reference a node in this scene`,
      });
      return;
    }
    if (camera.type !== "camera") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activeCameraId"],
        message: `activeCameraId "${scene.activeCameraId}" must reference a camera node`,
      });
    }
  });

export type SceneDefinitionV3 = z.infer<typeof SceneDefinitionV3Schema>;
