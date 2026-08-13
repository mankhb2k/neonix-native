/**
 * V1 components & dependencies.
 *
 * A component is a sealed design template with public props and variants.
 * Consumers (project layer instances, project bindings) may override only public props.
 * Owner wiring from props to internals uses `propBindings` — not a consumer API.
 *
 * Prop kinds are AI/user-friendly: text | number | boolean | color | choice | asset.
 * Prop values may be static, variable-bound, or keyframed (when animatable).
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import { VariableSchema } from "./variables";
import { JsonValueSchema } from "./values";
import {
  IdSchema,
  PropertyPathSchema,
  SemverSchema,
  FiniteNumberSchema,
  SemanticSchema,
} from "./common";
import { LayerV1Schema } from "./layers";
import { ComponentPropValueSchema } from "./prop-values";

/** Public prop kinds — AI/user friendly (no string/enum/list). */
export const ComponentPropKindSchema = z.enum([
  "text",
  "number",
  "boolean",
  "color",
  "choice",
  "asset",
]);

/** Asset slot classification for `kind: "asset"` props. */
export const ComponentPropAssetKindSchema = z.enum([
  "image",
  "video",
  "audio",
  "svg",
  "font",
  "media",
]);

export function defaultAnimatableForPropKind(
  kind: z.infer<typeof ComponentPropKindSchema>,
): boolean {
  return kind !== "choice" && kind !== "asset";
}

export function defaultInterpolationForPropKind(
  kind: z.infer<typeof ComponentPropKindSchema>,
): "step" | "linear" | "color" {
  if (kind === "number") return "linear";
  if (kind === "color") return "color";
  return "step";
}

/** Public prop declared on a component definition. */
export const ComponentPropV1Schema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).optional(),
    kind: ComponentPropKindSchema,
    default: JsonValueSchema,
    /** When omitted, inferred: choice/asset → false; others → true. */
    animatable: z.boolean().optional(),
    /** Required when kind === "asset". */
    assetKind: ComponentPropAssetKindSchema.optional(),
    semantic: SemanticSchema.optional(),
    min: FiniteNumberSchema.optional(),
    max: FiniteNumberSchema.optional(),
    step: FiniteNumberSchema.positive().optional(),
    /** Required when kind === "choice". */
    options: z
      .array(z.string())
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.enumOptions)
      .optional(),
  })
  .strict()
  .superRefine((prop, ctx) => {
    if (prop.kind === "asset" && prop.assetKind === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Prop "${prop.id}" with kind "asset" requires assetKind`,
        path: ["assetKind"],
      });
    }
    if (prop.kind === "choice") {
      if (!prop.options || prop.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Prop "${prop.id}" with kind "choice" requires options`,
          path: ["options"],
        });
      } else if (
        typeof prop.default === "string" &&
        !prop.options.includes(prop.default)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Prop "${prop.id}" default must be one of options`,
          path: ["default"],
        });
      }
    }
  });

export const ComponentPropBindingTargetV1Schema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("layerProperty"),
      layerId: IdSchema,
      property: PropertyPathSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("childProp"),
      childLayerId: IdSchema,
      propId: IdSchema,
    })
    .strict(),
]);

/** Owner wiring: resolved prop value → internal layer property or child component prop. */
export const ComponentPropBindingV1Schema = z
  .object({
    propId: IdSchema,
    target: ComponentPropBindingTargetV1Schema,
  })
  .strict();

/** Typed variant preset — overrides public props only. */
export const ComponentVariantV1Schema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    props: z.record(ComponentPropValueSchema).default({}),
  })
  .strict();

export const ComponentDefinitionV1Schema = z
  .object({
    id: IdSchema,
    version: SemverSchema,
    integrity: z.string().min(1),

    // ── Public consumer surface ─────────────────────────────────
    props: z
      .array(ComponentPropV1Schema)
      .max(MOTION_PROTOCOL_LIMITS.publicParamsPerComponent)
      .default([]),
    variants: z.array(ComponentVariantV1Schema).max(128).default([]),

    // ── Owner-only wiring (not consumer API) ─────────────────────
    propBindings: z
      .array(ComponentPropBindingV1Schema)
      .max(MOTION_PROTOCOL_LIMITS.bindingsPerArtifact)
      .default([]),

    // ── Owner-only internals (sealed from consumers) ─────────────
    variables: z
      .array(VariableSchema)
      .max(MOTION_PROTOCOL_LIMITS.variablesPerArtifact)
      .default([]),
    layers: z
      .array(LayerV1Schema)
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.layersPerComponent),
  })
  .strict()
  .superRefine((val, ctx) => {
    const propIds = new Set<string>();
    for (let i = 0; i < val.props.length; i++) {
      const prop = val.props[i]!;
      if (propIds.has(prop.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate prop id "${prop.id}"`,
          path: ["props", i, "id"],
        });
      }
      propIds.add(prop.id);
    }
  });

export const ComponentDependencyV1Schema = z
  .object({
    componentId: IdSchema,
    version: SemverSchema,
    source: IdSchema.optional(),
    integrity: z.string().min(1),
  })
  .strict();

export const PluginDependencySchema = z
  .object({
    pluginId: IdSchema,
    version: SemverSchema,
    integrity: z.string().min(1),
  })
  .strict();

export const ProjectDependenciesV1Schema = z
  .object({
    compiler: z.object({ range: z.string().min(1) }).strict(),
    components: z
      .array(ComponentDependencyV1Schema)
      .max(MOTION_PROTOCOL_LIMITS.dependenciesPerProject)
      .default([]),
    plugins: z
      .array(PluginDependencySchema)
      .max(MOTION_PROTOCOL_LIMITS.dependenciesPerProject)
      .optional(),
  })
  .strict();

export type ComponentDefinitionV1 = z.infer<typeof ComponentDefinitionV1Schema>;
export type ComponentPropV1 = z.infer<typeof ComponentPropV1Schema>;
export type ComponentPropKind = z.infer<typeof ComponentPropKindSchema>;
export type ComponentPropAssetKind = z.infer<
  typeof ComponentPropAssetKindSchema
>;
export type ComponentPropBindingV1 = z.infer<
  typeof ComponentPropBindingV1Schema
>;
export type ComponentPropBindingTargetV1 = z.infer<
  typeof ComponentPropBindingTargetV1Schema
>;
export type ComponentDependencyV1 = z.infer<typeof ComponentDependencyV1Schema>;
export type ProjectDependenciesV1 = z.infer<typeof ProjectDependenciesV1Schema>;
export type ComponentVariantV1 = z.infer<typeof ComponentVariantV1Schema>;
