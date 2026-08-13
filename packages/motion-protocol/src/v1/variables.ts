/**
 * V1 variables, design tokens and project bindings.
 *
 * Variable kinds mirror v2 but the `list` kind carries an explicit item
 * schema so AI/editor tooling can validate list payloads structurally.
 * Design tokens extend v2 `DesignTokensSchema` with `radii` and `motion`.
 * Bindings may target a project layer or a component instance layer.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import {
  FiniteNumberSchema,
  IdSchema,
  NormalizedRatioSchema,
  PropertyPathSchema,
  SemanticSchema,
} from "./common";
import { JsonValueSchema } from "./values";

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
        .max(MOTION_PROTOCOL_LIMITS.enumOptions)
        .optional(),
      itemSchema: z.lazy(() => ListFieldSchema).optional(),
    })
    .strict(),
);

export const ProjectVariableV1Schema = z.discriminatedUnion("type", [
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
    options: z.array(z.string()).min(1).max(MOTION_PROTOCOL_LIMITS.enumOptions),
  }).strict(),
  ScalarVariableBaseSchema.extend({
    type: z.literal("list"),
    itemSchema: z
      .object({ type: z.literal("object"), fields: z.record(ListFieldSchema) })
      .strict(),
    value: z
      .array(z.record(JsonValueSchema))
      .max(MOTION_PROTOCOL_LIMITS.listItems),
  }).strict(),
]);

export type ProjectVariableV1 = z.infer<typeof ProjectVariableV1Schema>;

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

export const ProjectBindingV1Schema = z
  .object({
    id: IdSchema,
    source: VariableBindingSourceSchema,
    target: z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("layer"),
          layerId: IdSchema,
          property: PropertyPathSchema,
        })
        .strict(),
      z
        .object({
          type: z.literal("component"),
          componentId: IdSchema,
          /** Public prop id declared by the component owner. */
          propId: IdSchema,
        })
        .strict(),
      z
        .object({
          type: z.literal("componentLayer"),
          layerId: IdSchema,
          /** Public prop id declared by the referenced component owner. */
          propId: IdSchema,
        })
        .strict(),
    ]),
  })
  .strict();

export type ProjectBindingV1 = z.infer<typeof ProjectBindingV1Schema>;

// ── Public canonical variable schema ──────────────────────────────────
//
// VariableSchema is the canonical V1 variable type used by both project
// variables and component variables. Supports `semantic` tagging,
// `list` variables with structured item schemas, and all scalar types.

export const VariableSchema = ProjectVariableV1Schema;

export type MotionVariable = z.infer<typeof VariableSchema>;

export const ContextBindingSourceSchema = z
  .object({ kind: z.literal("context"), path: PropertyPathSchema })
  .strict();

/** Owner-only: bind a component-local variable/context into an internal layer. */
export const ComponentBindingSchema = z
  .object({
    id: IdSchema,
    source: z.union([VariableBindingSourceSchema, ContextBindingSourceSchema]),
    target: z
      .object({ layerId: IdSchema, property: PropertyPathSchema })
      .strict(),
  })
  .strict();

export const ProjectBindingSchema = z
  .object({
    id: IdSchema,
    source: VariableBindingSourceSchema,
    target: z
      .object({
        type: z.literal("layer"),
        layerId: IdSchema,
        property: PropertyPathSchema,
      })
      .strict(),
  })
  .strict();

export const PublicParamSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).optional(),
    type: z.enum([
      "string",
      "color",
      "number",
      "boolean",
      "asset",
      "enum",
      "list",
    ]),
    label: z.string().min(1).optional(),
    variableId: IdSchema,
    semantic: SemanticSchema.optional(),
    min: FiniteNumberSchema.optional(),
    max: FiniteNumberSchema.optional(),
    step: FiniteNumberSchema.positive().optional(),
    previewHint: z.string().optional(),
    options: z
      .array(z.string())
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.enumOptions)
      .optional(),
    group: z.enum(["content", "style", "motion", "layout", "audio"]).optional(),
    control: z
      .enum([
        "text",
        "textarea",
        "color-picker",
        "slider",
        "toggle",
        "asset-picker",
        "enum",
      ])
      .optional(),
    capability: z.enum(["basic", "advanced", "designer-only"]).optional(),
  })
  .strict();
