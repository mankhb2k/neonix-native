/**
 * V3 components & dependencies.
 *
 * Components are sealed, owner-owned units:
 * - The component owner fully controls internal structure (nodes, bindings, actions).
 * - Consumers can only use the public API (publicParams, slots, typed variants, publicTargets).
 * - Project-level bindings must not target arbitrary component internals.
 *
 * Dependencies pin compiler + component + plugin versions.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import { PublicParamSchema, VariableSchema } from "./variables";
import { JsonValueSchema, ResolvableValueSchema, ValueKindSchema } from "./values";
import { IdSchema, PropertyPathSchema, SemverSchema } from "./common";
import { ProjectBindingV3Schema } from "./variables";
import { NodeV3Schema } from "./nodes";
import { MotionClipV3Schema } from "./animation/clips";

export const PublicParamV3Schema = PublicParamSchema;

/** Content kinds a slot can accept. */
export const SlotContentKindSchema = z.enum([
  "text",
  "image",
  "svg",
  "video",
  "color",
  "number",
  "boolean",
  "asset",
]);

/** Structured content insertion without exposing internals. */
export const ComponentSlotV3Schema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    accepts: z.array(SlotContentKindSchema).min(1).max(8),
    count: z.number().int().min(1).max(16).default(1),
    fallback: JsonValueSchema.optional(),
    previewHint: z.string().optional(),
  })
  .strict();

/**
 * Public binding target — the owner exposes only these node/property paths
 * for consumer bindings. Consumers reference targets by `targetId`, never
 * by raw `nodeId.property`.
 */
export const ComponentPublicTargetV3Schema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).optional(),
    nodeId: IdSchema,
    property: PropertyPathSchema,
    /**
     * Expected value kind for consumer-supplied `publicProps` values.
     * When omitted, the kind is inferred from `property` during reference
     * validation (transform.* → number/boolean, payload.color → color, etc.).
     */
    valueKind: ValueKindSchema.optional(),
    description: z.string().optional(),
  })
  .strict();

/**
 * Typed variant preset — owner-approved configuration that alters layout,
 * style, or motion via public-target overrides.
 *
 * `overrides` is keyed by `publicTarget` id, so a variant can only influence
 * the component's declared public surface — never arbitrary internals.
 * `params` is retained for backward compatibility with pre-existing fixtures.
 */
export const ComponentVariantV3Schema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    /** Public-target overrides keyed by `publicTarget` id. */
    overrides: z.record(ResolvableValueSchema).default({}),
    /** @deprecated Legacy free-form params; prefer `overrides`. */
    params: z.record(JsonValueSchema).default({}),
    previewHint: z.string().optional(),
  })
  .strict();

export const ComponentActionV3Schema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).optional(),
    clips: z
      .array(MotionClipV3Schema)
      .max(MOTION_PROTOCOL_LIMITS.clipsPerAction),
    params: z.record(JsonValueSchema).optional(),
  })
  .strict();

export const EmbeddedComponentV3Schema = z
  .object({
    id: IdSchema,
    version: SemverSchema,
    integrity: z.string().min(1),

    // ── Public consumer surface ─────────────────────────────────
    publicParams: z
      .array(PublicParamV3Schema)
      .max(MOTION_PROTOCOL_LIMITS.publicParamsPerComponent)
      .default([]),
    slots: z.array(ComponentSlotV3Schema).max(64).default([]),
    /** Typed, enumerable owner-approved presets. */
    variants: z.array(ComponentVariantV3Schema).max(128).default([]),
    /** Exposed node/property paths for consumer bindings. */
    publicTargets: z
      .array(ComponentPublicTargetV3Schema)
      .max(MOTION_PROTOCOL_LIMITS.bindingsPerArtifact)
      .default([]),

    // ── Owner-only internals (sealed from consumers) ─────────────
    variables: z
      .array(VariableSchema)
      .max(MOTION_PROTOCOL_LIMITS.variablesPerArtifact)
      .default([]),
    nodes: z
      .array(NodeV3Schema)
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.nodesPerComponent),
    bindings: z
      .array(ProjectBindingV3Schema)
      .max(MOTION_PROTOCOL_LIMITS.bindingsPerArtifact)
      .default([]),
    actions: z
      .array(ComponentActionV3Schema)
      .max(MOTION_PROTOCOL_LIMITS.actionsPerComponent)
      .default([]),
    assetDependencies: z
      .array(IdSchema)
      .max(MOTION_PROTOCOL_LIMITS.assetsPerArtifact)
      .optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    // --- Slot id uniqueness ---
    const slotIds = new Set<string>();
    for (let i = 0; i < val.slots.length; i++) {
      const sid = val.slots[i].id;
      if (slotIds.has(sid)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate slot id "${sid}"`,
          path: ["slots", i, "id"],
        });
      }
      slotIds.add(sid);
    }

    // NOTE: Consumer-side slot-content cardinality (count) is validated
    // at the component-instance level once slot-content schemas land.
  });

export const ComponentDependencyV3Schema = z
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

export const ProjectDependenciesV3Schema = z
  .object({
    compiler: z.object({ range: z.string().min(1) }).strict(),
    components: z
      .array(ComponentDependencyV3Schema)
      .max(MOTION_PROTOCOL_LIMITS.dependenciesPerProject)
      .default([]),
    plugins: z
      .array(PluginDependencySchema)
      .max(MOTION_PROTOCOL_LIMITS.dependenciesPerProject)
      .optional(),
  })
  .strict();

export type EmbeddedComponentV3 = z.infer<typeof EmbeddedComponentV3Schema>;
export type ComponentDependencyV3 = z.infer<typeof ComponentDependencyV3Schema>;
export type ProjectDependenciesV3 = z.infer<typeof ProjectDependenciesV3Schema>;
export type SlotContentKind = z.infer<typeof SlotContentKindSchema>;
export type ComponentPublicTargetV3 = z.infer<
  typeof ComponentPublicTargetV3Schema
>;
export type ComponentVariantV3 = z.infer<typeof ComponentVariantV3Schema>;
export type ComponentSlotV3 = z.infer<typeof ComponentSlotV3Schema>;
