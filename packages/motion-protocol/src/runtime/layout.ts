import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import { FiniteNumberSchema, IdSchema, PropertyPathSchema } from "./common";

export const RepeatSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("list"), variableId: IdSchema, keyPath: PropertyPathSchema }).strict(),
  z.object({ kind: z.literal("count"), count: FiniteNumberSchema.int().positive().max(MOTION_PROTOCOL_LIMITS.repeaterInstances), keyPrefix: IdSchema.default("item") }).strict(),
]);

export const RepeatLayoutSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({ kind: z.literal("linear"), offsetX: FiniteNumberSchema, offsetY: FiniteNumberSchema }).strict(),
  z.object({ kind: z.literal("grid"), columns: FiniteNumberSchema.int().positive().max(MOTION_PROTOCOL_LIMITS.repeaterGridColumns), gapX: FiniteNumberSchema, gapY: FiniteNumberSchema }).strict(),
  z.object({ kind: z.literal("radial"), radius: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension), startAngle: FiniteNumberSchema, endAngle: FiniteNumberSchema, orientToAngle: z.boolean().default(false) }).strict(),
]);

export const RepeaterSchema = z.object({
  source: RepeatSourceSchema,
  itemAlias: IdSchema.default("item"),
  indexAlias: IdSchema.default("index"),
  layout: RepeatLayoutSchema,
  timeStagger: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.mediaDurationSeconds).default(0),
}).strict();

export const EdgeInsetsSchema = z
  .object({
    top: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension),
    right: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension),
    bottom: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension),
    left: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension),
  })
  .strict();

export const LayoutItemPolicySchema = z
  .object({
    width: z.enum(["fixed", "content", "fill"]).optional(),
    height: z.enum(["fixed", "content", "fill"]).optional(),
    grow: FiniteNumberSchema.nonnegative().max(100).optional(),
    shrink: FiniteNumberSchema.nonnegative().max(100).optional(),
    alignSelf: z.enum(["auto", "start", "center", "end", "stretch"]).optional(),
    minWidth: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension).optional(),
    maxWidth: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension).optional(),
    minHeight: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension).optional(),
    maxHeight: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension).optional(),
  })
  .strict();

const PaddingSchema = z.union([
  FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension),
  EdgeInsetsSchema,
]);

export const LayoutConstraintSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("stack"),
      direction: z.enum(["horizontal", "vertical"]),
      gap: FiniteNumberSchema.nonnegative().default(0),
      padding: PaddingSchema.default(0),
      align: z.enum(["start", "center", "end", "stretch"]).default("start"),
      justify: z.enum(["start", "center", "end", "space-between"]).default("start"),
      wrap: z.enum(["none", "wrap"]).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("grid"),
      columns: FiniteNumberSchema.int().positive().max(32),
      gapX: FiniteNumberSchema.nonnegative().default(0),
      gapY: FiniteNumberSchema.nonnegative().default(0),
    })
    .strict(),
  z
    .object({
      kind: z.literal("align"),
      axis: z.enum(["x", "y", "both"]),
      align: z.enum(["start", "center", "end"]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("distribute"),
      axis: z.enum(["x", "y"]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("anchor"),
      targetLayerId: IdSchema,
      offsetX: FiniteNumberSchema.default(0),
      offsetY: FiniteNumberSchema.default(0),
    })
    .strict(),
]);

export type EdgeInsets = z.infer<typeof EdgeInsetsSchema>;
export type LayoutItemPolicy = z.infer<typeof LayoutItemPolicySchema>;
