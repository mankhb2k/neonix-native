/**
 * V3 variables, design tokens and project bindings.
 *
 * Variable kinds mirror v2 but the `list` kind carries an explicit item
 * schema so AI/editor tooling can validate list payloads structurally.
 * Design tokens extend v2 `DesignTokensSchema` with `radii` and `motion`.
 * Bindings may target either a scene node or a component instance node.
 */
import { z } from "zod";
import { MOTION_V2_LIMITS } from "../capabilities";
import {
  FiniteNumberSchema,
  IdSchema,
  NormalizedRatioSchema,
  PropertyPathSchema,
  SemanticSchema,
} from "./common";
import { JsonValueSchema } from "../v2/values";

const ScalarVariableBaseSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  semantic: SemanticSchema.optional(),
});

export type ListField = {
  type: "string" | "color" | "number" | "boolean" | "asset" | "enum" | "list";
  options?: string[];
  itemSchema?: ListField;
};

export const ListFieldSchema: z.ZodType<ListField> = z.lazy(() =>
  z
    .object({
      type: z.enum([
        "string",
        "color",
        "number",
        "boolean",
        "asset",
        "enum",
        "list",
      ]),
      options: z
        .array(z.string())
        .min(1)
        .max(MOTION_V2_LIMITS.enumOptions)
        .optional(),
      itemSchema: z.lazy(() => ListFieldSchema).optional(),
    })
    .strict(),
);

export const ProjectVariableV3Schema = z.discriminatedUnion("type", [
  ScalarVariableBaseSchema.extend({
    type: z.literal("string"),
    value: z.string(),
  }).strict(),
  ScalarVariableBaseSchema.extend({
    type: z.literal("color"),
    value: z.string().min(1),
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
    type: z.literal("enum"),
    value: z.string(),
    options: z.array(z.string()).min(1).max(MOTION_V2_LIMITS.enumOptions),
  }).strict(),
  ScalarVariableBaseSchema.extend({
    type: z.literal("list"),
    itemSchema: z
      .object({ type: z.literal("object"), fields: z.record(ListFieldSchema) })
      .strict(),
    value: z.array(z.record(JsonValueSchema)).max(MOTION_V2_LIMITS.listItems),
  }).strict(),
]);

export type ProjectVariableV3 = z.infer<typeof ProjectVariableV3Schema>;

export const DesignTokensSchema = z
  .object({
    colors: z.record(z.string().min(1).max(64)).optional(),
    fonts: z.record(z.string().min(1).max(128)).optional(),
    spacing: z.record(FiniteNumberSchema).optional(),
    radii: z.record(NormalizedRatioSchema).optional(),
    motion: z.record(FiniteNumberSchema).optional(),
  })
  .strict();

export type DesignTokens = z.infer<typeof DesignTokensSchema>;

export const VariableBindingSourceSchema = z
  .object({ kind: z.literal("variable"), variableId: IdSchema })
  .strict();

export const ProjectBindingV3Schema = z
  .object({
    id: IdSchema,
    source: VariableBindingSourceSchema,
    target: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("scene"),
          sceneId: IdSchema,
          nodeId: IdSchema,
          property: PropertyPathSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("component"),
          componentId: IdSchema,
          nodeId: IdSchema,
          property: PropertyPathSchema,
        })
        .strict(),
    ]),
  })
  .strict();

export type ProjectBindingV3 = z.infer<typeof ProjectBindingV3Schema>;
