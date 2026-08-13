/**
 * V1 audio layer — root-only leaf. Playback fields live on payload;
 * timeline placement lives on `timing`.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import {
  FiniteNumberSchema,
  IdSchema,
  NormalizedRatioSchema,
  PositiveNumberSchema,
} from "../common";
import { LayerTimingSchema } from "./timing";

export const AudioLayerPayloadV1Schema = z
  .object({
    assetId: IdSchema,
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
  .strict();

export const AudioLayerV1Schema = z
  .object({
    id: IdSchema,
    type: z.literal("audio"),
    name: z.string().min(1).optional(),
    parentLayerId: z.null(),
    zIndex: z.number().int().negative(),
    timing: LayerTimingSchema,
    visible: z.boolean().default(true),
    locked: z.boolean().default(false),
    payload: AudioLayerPayloadV1Schema,
  })
  .strict();

export type AudioLayerV1 = z.infer<typeof AudioLayerV1Schema>;

export function collectAudioLayerTimingIssues(
  layer: AudioLayerV1,
): Array<{ path: (string | number)[]; message: string }> {
  const issues: Array<{ path: (string | number)[]; message: string }> = [];
  const { payload, timing } = layer;
  if (payload.trimEnd !== undefined && payload.trimEnd > timing.duration) {
    issues.push({
      path: ["payload", "trimEnd"],
      message: `trimEnd (${payload.trimEnd}) must be ≤ duration (${timing.duration})`,
    });
  }
  if (payload.fadeIn + payload.fadeOut > timing.duration) {
    issues.push({
      path: ["payload", "fadeIn"],
      message: `fadeIn (${payload.fadeIn}) + fadeOut (${payload.fadeOut}) must be ≤ duration (${timing.duration})`,
    });
  }
  return issues;
}
