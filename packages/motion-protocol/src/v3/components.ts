/**
 * V3 components & dependencies.
 *
 * Components are embedded definitions (`EmbeddedComponentV3Schema`) with
 * public params, variables, nodes, bindings and actions. Dependencies pin
 * compiler + component + plugin versions.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import { PublicParamSchema, VariableSchema } from "./variables";
import { JsonValueSchema } from "./values";
import { IdSchema, SemverSchema } from "./common";
import { ProjectBindingV3Schema } from "./variables";
import { NodeV3Schema } from "./nodes";
import { MotionClipV3Schema } from "./animation/clips";

export const PublicParamV3Schema = PublicParamSchema;

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
    publicParams: z
      .array(PublicParamV3Schema)
      .max(MOTION_PROTOCOL_LIMITS.publicParamsPerComponent)
      .default([]),
    variables: z
      .array(VariableSchema)
      .max(MOTION_PROTOCOL_LIMITS.variablesPerArtifact)
      .default([]),
    nodes: z.array(NodeV3Schema).max(MOTION_PROTOCOL_LIMITS.nodesPerComponent),
    bindings: z
      .array(ProjectBindingV3Schema)
      .max(MOTION_PROTOCOL_LIMITS.bindingsPerArtifact)
      .default([]),
    actions: z
      .array(ComponentActionV3Schema)
      .max(MOTION_PROTOCOL_LIMITS.actionsPerComponent)
      .default([]),
    variants: z.record(JsonValueSchema).optional(),
    assetDependencies: z
      .array(IdSchema)
      .max(MOTION_PROTOCOL_LIMITS.assetsPerArtifact)
      .optional(),
  })
  .strict();

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
