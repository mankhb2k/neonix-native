/**
 * V3 property tracks — canonical track/easing/extrapolation schemas.
 */

import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema, PropertyPathSchema } from "../common";
import { ResolvableValueSchema, ValueKindSchema } from "../values";
import { KeyframeEasingSchema } from "./easing";

export const ExtrapolationBehaviorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("clamp") }).strict(),
  z
    .object({
      type: z.literal("cycle"),
      mode: z.enum(["repeat", "pingpong"]).optional(),
    })
    .strict(),
  z.object({ type: z.literal("continue") }).strict(),
]);

export const SceneMarkerSchema = z
  .object({
    id: IdSchema,
    t: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
  })
  .strict();

/** Absolute seconds or marker-relative time resolved at compile time. */
export const TrackTimeSchema = z.union([
  FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds),
  z
    .object({
      markerId: IdSchema,
      offset: FiniteNumberSchema.default(0),
    })
    .strict(),
]);

export const PropertyTrackSchema = z
  .object({
    targetId: IdSchema,
    property: PropertyPathSchema,
    valueKind: ValueKindSchema.optional(),
    preBehavior: ExtrapolationBehaviorSchema.optional(),
    postBehavior: ExtrapolationBehaviorSchema.optional(),
    keys: z
      .array(
        z
          .object({
            t: TrackTimeSchema,
            v: ResolvableValueSchema,
            easing: KeyframeEasingSchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.keysPerTrack),
  })
  .strict();

// ── V3 aliases ────────────────────────────────────────────────────────

export const PropertyTrackV3Schema = PropertyTrackSchema;
export const ExtrapolationBehaviorV3Schema = ExtrapolationBehaviorSchema;
export const TrackTimeV3Schema = TrackTimeSchema;
export const SceneMarkerV3Schema = SceneMarkerSchema;

/** Clip-local time in seconds (must be non-negative). */
export const TimeSecondsSchema = FiniteNumberSchema.nonnegative().max(
  MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
);

export type PropertyTrackV3 = z.infer<typeof PropertyTrackV3Schema>;
