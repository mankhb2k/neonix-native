/**
 * Variable và project binding V1.
 *
 * Binding chỉ nối project.variables → public prop.
 * Target duy nhất: { type: "prop", layerId, propId }.
 * Không bind layer field, internals, hay computed value.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import { ColorHexSchema, FiniteNumberSchema, IdSchema, SemanticSchema } from "../v1/common";

const ScalarVariableBaseSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).optional(),
  semantic: SemanticSchema.optional(),
});

export const ProjectVariableV1Schema = z.discriminatedUnion("type", [
  ScalarVariableBaseSchema.extend({
    type: z.literal("string"),
    value: z.string(),
  }).strict(),
  ScalarVariableBaseSchema.extend({
    type: z.literal("color"),
    value: ColorHexSchema,
  }).strict(),
  ScalarVariableBaseSchema.extend({
    type: z.literal("number"),
    value: FiniteNumberSchema,
    min: FiniteNumberSchema.optional(),
    max: FiniteNumberSchema.optional(),
  }).strict(),
  ScalarVariableBaseSchema.extend({
    type: z.literal("boolean"),
    value: z.boolean(),
  }).strict(),
  ScalarVariableBaseSchema.extend({
    type: z.literal("asset"),
    assetKind: z.enum(["image", "video", "audio", "svg", "font"]),
    value: IdSchema,
  }).strict(),
  ScalarVariableBaseSchema.extend({
    type: z.literal("choice"),
    value: z.string(),
    options: z.array(z.string()).min(1).max(MOTION_PROTOCOL_LIMITS.enumOptions),
  }).strict(),
]);

export type ProjectVariableV1 = z.infer<typeof ProjectVariableV1Schema>;

export const VariableBindingSourceSchema = z
  .object({ kind: z.literal("variable"), variableId: IdSchema })
  .strict();

export const ProjectBindingV1Schema = z
  .object({
    id: IdSchema,
    source: VariableBindingSourceSchema,
    target: z
      .object({
        type: z.literal("prop"),
        layerId: IdSchema,
        propId: IdSchema,
      })
      .strict(),
  })
  .strict();

export type ProjectBindingV1 = z.infer<typeof ProjectBindingV1Schema>;

export const VariableSchema = ProjectVariableV1Schema;

export type MotionVariable = z.infer<typeof VariableSchema>;
