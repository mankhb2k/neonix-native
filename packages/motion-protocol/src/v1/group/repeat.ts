import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema, PropertyPathSchema } from "../common";

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
      count: FiniteNumberSchema.int().positive().max(
        MOTION_PROTOCOL_LIMITS.repeaterInstances,
      ),
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
      columns: FiniteNumberSchema.int().positive().max(
        MOTION_PROTOCOL_LIMITS.repeaterGridColumns,
      ),
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

export const GroupRepeaterSchema = RepeaterSchema;

export type RepeatSource = z.infer<typeof RepeatSourceSchema>;
export type RepeatLayout = z.infer<typeof RepeatLayoutSchema>;
export type Repeater = z.infer<typeof RepeaterSchema>;
