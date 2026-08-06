import { z } from "zod";
import { MOTION_V2_LIMITS } from "../capabilities";
import { FiniteNumberSchema, IdSchema, PropertyPathSchema, SemanticSchema } from "./common";
import { JsonValueSchema } from "./values";

const ScalarVariableSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
});

const ObjectFieldSchema = z.object({
  type: z.enum(["string", "color", "number", "boolean", "asset"]),
});

export const VariableV2Schema = z.discriminatedUnion("type", [
  ScalarVariableSchema.extend({ type: z.literal("string"), value: z.string() }).strict(),
  ScalarVariableSchema.extend({ type: z.literal("color"), value: z.string().min(1) }).strict(),
  ScalarVariableSchema.extend({
    type: z.literal("number"),
    value: FiniteNumberSchema,
    min: FiniteNumberSchema.optional(),
    max: FiniteNumberSchema.optional(),
  }).strict(),
  ScalarVariableSchema.extend({ type: z.literal("boolean"), value: z.boolean() }).strict(),
  ScalarVariableSchema.extend({
    type: z.literal("asset"),
    assetKind: z.enum(["image", "video", "audio", "svg", "font"]),
    value: IdSchema,
  }).strict(),
  ScalarVariableSchema.extend({
    type: z.literal("enum"),
    value: z.string(),
    options: z.array(z.string()).min(1).max(MOTION_V2_LIMITS.enumOptions),
  }).strict(),
  ScalarVariableSchema.extend({
    type: z.literal("list"),
    itemSchema: z
      .object({ type: z.literal("object"), fields: z.record(ObjectFieldSchema) })
      .strict(),
    value: z.array(z.record(JsonValueSchema)).max(MOTION_V2_LIMITS.listItems),
  }).strict(),
]);

export const VariableBindingSourceSchema = z.object({ kind: z.literal("variable"), variableId: IdSchema }).strict();
export const ContextBindingSourceSchema = z.object({ kind: z.literal("context"), path: PropertyPathSchema }).strict();

export const ComponentBindingSchema = z
  .object({
    id: IdSchema,
    source: z.union([VariableBindingSourceSchema, ContextBindingSourceSchema]),
    target: z.object({ nodeId: IdSchema, property: PropertyPathSchema }).strict(),
  })
  .strict();

export const ProjectBindingSchema = z
  .object({
    id: IdSchema,
    source: VariableBindingSourceSchema,
    target: z.object({ sceneId: IdSchema, nodeId: IdSchema, property: PropertyPathSchema }).strict(),
  })
  .strict();

export const PublicParamV2Schema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).optional(),
    type: z.enum(["string", "color", "number", "boolean", "asset", "enum", "list"]),
    label: z.string().min(1).optional(),
    variableId: IdSchema,
    semantic: SemanticSchema.optional(),
    min: FiniteNumberSchema.optional(),
    max: FiniteNumberSchema.optional(),
    step: FiniteNumberSchema.positive().optional(),
    previewHint: z.string().optional(),
    options: z.array(z.string()).min(1).max(MOTION_V2_LIMITS.enumOptions).optional(),
    group: z.enum(["content", "style", "motion", "layout", "audio"]).optional(),
    control: z.enum(["text", "textarea", "color-picker", "slider", "toggle", "asset-picker", "enum"]).optional(),
    capability: z.enum(["basic", "advanced", "designer-only"]).optional(),
  })
  .strict();

export const PublicParamSchema = PublicParamV2Schema;
