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

// ── V2 backward-compat schemas (owned by V3) ──────────────────────────
//
// These are the original V2 variable/binding/public-param schemas.
// They differ from V3 in minor ways (no `semantic` on variables,
// `ComponentBindingSchema` supports context bindings, etc.)

const ScalarVariableSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
});

const ObjectFieldSchema = z.object({
  type: z.enum(["string", "color", "number", "boolean", "asset"]),
});

export const VariableV2Schema = z.discriminatedUnion("type", [
  ScalarVariableSchema.extend({
    type: z.literal("string"),
    value: z.string(),
  }).strict(),
  ScalarVariableSchema.extend({
    type: z.literal("color"),
    value: z.string().min(1),
  }).strict(),
  ScalarVariableSchema.extend({
    type: z.literal("number"),
    value: FiniteNumberSchema,
    min: FiniteNumberSchema.optional(),
    max: FiniteNumberSchema.optional(),
  }).strict(),
  ScalarVariableSchema.extend({
    type: z.literal("boolean"),
    value: z.boolean(),
  }).strict(),
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
      .object({
        type: z.literal("object"),
        fields: z.record(ObjectFieldSchema),
      })
      .strict(),
    value: z.array(z.record(JsonValueSchema)).max(MOTION_V2_LIMITS.listItems),
  }).strict(),
]);

export type VariableV2 = z.infer<typeof VariableV2Schema>;

export const ContextBindingSourceSchema = z
  .object({ kind: z.literal("context"), path: PropertyPathSchema })
  .strict();

export const ComponentBindingSchema = z
  .object({
    id: IdSchema,
    source: z.union([VariableBindingSourceSchema, ContextBindingSourceSchema]),
    target: z
      .object({ nodeId: IdSchema, property: PropertyPathSchema })
      .strict(),
  })
  .strict();

export const ProjectBindingSchema = z
  .object({
    id: IdSchema,
    source: VariableBindingSourceSchema,
    target: z
      .object({
        sceneId: IdSchema,
        nodeId: IdSchema,
        property: PropertyPathSchema,
      })
      .strict(),
  })
  .strict();

export const PublicParamV2Schema = z
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
      .max(MOTION_V2_LIMITS.enumOptions)
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

/** @deprecated Use `VariableSchema` instead. */
export const PublicParamSchema = PublicParamV2Schema;

// ── Phase 7 neutral aliases ─────────────────────────────────────────

export const VariableSchema = VariableV2Schema;
