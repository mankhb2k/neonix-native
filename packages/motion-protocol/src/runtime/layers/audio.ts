/**
 * Runtime audio layer — root-only leaf. Same payload as authoring;
 * placement is `timing` (global).
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import {
  FiniteNumberSchema,
  IdSchema,
  NormalizedRatioSchema,
  PositiveNumberSchema,
} from "../../v1/common";
import { LayerTimingSchema } from "./base";

export const RuntimeAudioPayloadSchema = z
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

export const RuntimeAudioLayerSchema = z
  .object({
    id: IdSchema,
    type: z.literal("audio"),
    name: z.string().min(1).optional(),
    parentLayerId: z.null(),
    zIndex: z.number().int().negative(),
    timing: LayerTimingSchema,
    visible: z.boolean().default(true),
    locked: z.boolean().default(false),
    payload: RuntimeAudioPayloadSchema,
  })
  .strict();

export type RuntimeAudioLayer = z.infer<typeof RuntimeAudioLayerSchema>;
