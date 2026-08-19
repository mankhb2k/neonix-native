/**
 * Layer audio V1 — lá chỉ ở root. Playback trên payload; chỗ đứng trên timing.
 * Không frame, transform, appearance, layout. volume 0..100 nguyên, 100 = đầy.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import {
  FiniteNumberSchema,
  IdSchema,
  PercentSchema,
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
    volume: PercentSchema.default(100),
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
    parentLayerId: z.null(),
    zIndex: z.number().int().negative(),
    timing: LayerTimingSchema,
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
