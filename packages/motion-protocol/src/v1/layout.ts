/**
 * Schema layout V1 — repeater (lặp instance) và native `layout` / `layoutItem`.
 * Không nhầm với `frame` (size box).
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import { FiniteNumberSchema, IdSchema, PropertyPathSchema } from "./common";

export const RepeatSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("list"),
      variableId: IdSchema,
      keyPath: PropertyPathSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("count"),
      count: FiniteNumberSchema.int()
        .positive()
        .max(MOTION_PROTOCOL_LIMITS.repeaterInstances),
      keyPrefix: IdSchema.default("item"),
    })
    .strict(),
]);

export const RepeatLayoutSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z
    .object({
      kind: z.literal("linear"),
      offsetX: FiniteNumberSchema,
      offsetY: FiniteNumberSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("grid"),
      columns: FiniteNumberSchema.int()
        .positive()
        .max(MOTION_PROTOCOL_LIMITS.repeaterGridColumns),
      gapX: FiniteNumberSchema,
      gapY: FiniteNumberSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("radial"),
      radius: FiniteNumberSchema.nonnegative().max(
        MOTION_PROTOCOL_LIMITS.layerDimension,
      ),
      startAngle: FiniteNumberSchema,
      endAngle: FiniteNumberSchema,
      orientToAngle: z.boolean().default(false),
    })
    .strict(),
]);

export const RepeaterSchema = z
  .object({
    source: RepeatSourceSchema,
    itemAlias: IdSchema.default("item"),
    indexAlias: IdSchema.default("index"),
    layout: RepeatLayoutSchema,
    timeStagger: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds)
      .default(0),
  })
  .strict();

export const EdgeInsetsSchema = z
  .object({
    top: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.layerDimension,
    ),
    right: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.layerDimension,
    ),
    bottom: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.layerDimension,
    ),
    left: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.layerDimension,
    ),
  })
  .strict();

export const LayoutSizeModeSchema = z.enum(["fixed", "hug", "fill"]);
export const LayoutJustifySchema = z.enum([
  "start",
  "center",
  "end",
  "space-between",
]);
export const LayoutAlignSchema = z.enum([
  "start",
  "center",
  "end",
  "stretch",
]);

export const LayoutItemPolicySchema = z
  .object({
    width: LayoutSizeModeSchema.optional(),
    height: LayoutSizeModeSchema.optional(),
    alignSelf: z.enum(["auto", "start", "center", "end", "stretch"]).optional(),
    minWidth: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.layerDimension)
      .optional(),
    maxWidth: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.layerDimension)
      .optional(),
    minHeight: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.layerDimension)
      .optional(),
    maxHeight: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.layerDimension)
      .optional(),
  })
  .strict();

const PaddingSchema = z.union([
  FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension),
  EdgeInsetsSchema,
]);

export const LayoutConstraintSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("row"),
      gap: FiniteNumberSchema.nonnegative().default(0),
      padding: PaddingSchema.default(0),
      align: LayoutAlignSchema.default("start"),
      justify: LayoutJustifySchema.default("start"),
    })
    .strict(),
  z
    .object({
      mode: z.literal("column"),
      gap: FiniteNumberSchema.nonnegative().default(0),
      padding: PaddingSchema.default(0),
      align: LayoutAlignSchema.default("start"),
      justify: LayoutJustifySchema.default("start"),
    })
    .strict(),
  z
    .object({
      mode: z.literal("grid"),
      columns: FiniteNumberSchema.int().positive().max(32),
      gap: FiniteNumberSchema.nonnegative().default(0),
      padding: PaddingSchema.default(0),
      align: LayoutAlignSchema.default("start"),
      justify: LayoutJustifySchema.default("start"),
    })
    .strict(),
]);

export type EdgeInsets = z.infer<typeof EdgeInsetsSchema>;
export type LayoutItemPolicy = z.infer<typeof LayoutItemPolicySchema>;
