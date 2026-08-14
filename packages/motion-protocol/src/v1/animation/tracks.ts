/**
 * Property track V1 — track, easing, extrapolation, keyframe.
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

export const TimelineMarkerSchema = z
  .object({
    id: IdSchema,
    t: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
  })
  .strict();

// ── Value-kind compatibility map for property tracks ────────────────

/**
 * Maps property path patterns to allowed value kinds for property tracks.
 */
const VALUE_KIND_BY_PROPERTY: Record<string, string[]> = {
  "transform.translate.x": ["number", "angle"],
  "transform.translate.y": ["number", "angle"],
  "transform.rotate.x": ["number", "angle"],
  "transform.rotate.y": ["number", "angle"],
  "transform.rotate.z": ["number", "angle"],
  "transform.scale.x": ["number"],
  "transform.scale.y": ["number"],
  "transform.scale.z": ["number"],
  "transform.origin.x": ["number"],
  "transform.origin.y": ["number"],
  "transform.origin.z": ["number"],
  "transform.skew.x": ["number", "angle"],
  "transform.skew.y": ["number", "angle"],
  "transform.depth": ["number"],
  "transform.perspective": ["number"],
  "appearance.opacity": ["number"],
  "appearance.visible": ["boolean"],
  "frame.width": ["number"],
  "frame.height": ["number"],
};

/** Absolute seconds or marker-relative time resolved at compile time. */
export const TrackTimeSchema = z.union([
  FiniteNumberSchema.nonnegative().max(
    MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
  ),
  z
    .object({
      markerId: IdSchema,
      offset: FiniteNumberSchema.default(0),
    })
    .strict(),
]);

export const PropertyTrackSchema = z
  .object({
    layerId: IdSchema,
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
  .strict()
  .superRefine((val, ctx) => {
    if (!val.valueKind) return;
    const allowed = VALUE_KIND_BY_PROPERTY[val.property];
    if (allowed && !allowed.includes(val.valueKind)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `valueKind "${val.valueKind}" is incompatible with property "${val.property}". Allowed: ${allowed.join(", ")}`,
        path: ["valueKind"],
      });
    }
  });

// ── V1 aliases ────────────────────────────────────────────────────────

export const PropertyTrackV1Schema = PropertyTrackSchema;
export const ExtrapolationBehaviorV1Schema = ExtrapolationBehaviorSchema;
export const TrackTimeV1Schema = TrackTimeSchema;
export const TimelineMarkerV1Schema = TimelineMarkerSchema;

/** Clip-local time in seconds (must be non-negative). */
export const TimeSecondsSchema = FiniteNumberSchema.nonnegative().max(
  MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
);

export type PropertyTrackV1 = z.infer<typeof PropertyTrackV1Schema>;
