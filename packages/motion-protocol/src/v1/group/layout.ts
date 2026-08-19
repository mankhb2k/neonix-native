import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema } from "../common";

export const EdgeInsetsSchema = z
  .object({
    top: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension),
    right: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension),
    bottom: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension),
    left: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension),
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
    minWidth: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension).optional(),
    maxWidth: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension).optional(),
    minHeight: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension).optional(),
    maxHeight: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension).optional(),
  })
  .strict();

export const PaddingSchema = z.union([
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

export const GroupLayoutSchema = LayoutConstraintSchema;
export const GroupLayoutItemSchema = LayoutItemPolicySchema;

export type EdgeInsets = z.infer<typeof EdgeInsetsSchema>;
export type LayoutConstraint = z.infer<typeof LayoutConstraintSchema>;
export type LayoutItemPolicy = z.infer<typeof LayoutItemPolicySchema>;
