import { z } from "zod";
import { MOTION_V2_LIMITS } from "../capabilities";
import { FiniteNumberSchema, IdSchema, PropertyPathSchema } from "./common";

export const RepeatSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("list"), variableId: IdSchema, keyPath: PropertyPathSchema }).strict(),
  z.object({ kind: z.literal("count"), count: FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.repeaterInstances), keyPrefix: IdSchema.default("item") }).strict(),
]);

export const RepeatLayoutSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({ kind: z.literal("linear"), offsetX: FiniteNumberSchema, offsetY: FiniteNumberSchema }).strict(),
  z.object({ kind: z.literal("grid"), columns: FiniteNumberSchema.int().positive().max(MOTION_V2_LIMITS.repeaterGridColumns), gapX: FiniteNumberSchema, gapY: FiniteNumberSchema }).strict(),
  z.object({ kind: z.literal("radial"), radius: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension), startAngle: FiniteNumberSchema, endAngle: FiniteNumberSchema, orientToAngle: z.boolean().default(false) }).strict(),
]);

export const RepeaterSchema = z.object({
  source: RepeatSourceSchema,
  itemAlias: IdSchema.default("item"),
  indexAlias: IdSchema.default("index"),
  layout: RepeatLayoutSchema,
  timeStagger: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds).default(0),
}).strict();

export const LayoutConstraintSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("stack"),
      direction: z.enum(["horizontal", "vertical"]),
      gap: FiniteNumberSchema.nonnegative().default(0),
      padding: FiniteNumberSchema.nonnegative().default(0),
      align: z.enum(["start", "center", "end"]).default("start"),
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
      targetNodeId: IdSchema,
      offsetX: FiniteNumberSchema.default(0),
      offsetY: FiniteNumberSchema.default(0),
    })
    .strict(),
]);
