import { z } from "zod";
import { MOTION_V2_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema, PropertyPathSchema } from "../common";
import { ResolvableValueSchema, ValueKindSchema } from "../values";
import { KeyframeEasingV2Schema } from "./easing";

export const ExtrapolationBehaviorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("clamp") }).strict(),
  z.object({ type: z.literal("cycle"), mode: z.enum(["repeat", "pingpong"]).optional() }).strict(),
  z.object({ type: z.literal("continue") }).strict(),
]);

export const SceneMarkerSchema = z
  .object({
    id: IdSchema,
    t: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds),
  })
  .strict();

/** Absolute seconds or marker-relative time resolved at compile (R2-T4). */
export const TrackTimeSchema = z.union([
  FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds),
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
            easing: KeyframeEasingV2Schema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(MOTION_V2_LIMITS.keysPerTrack),
  })
  .strict();
