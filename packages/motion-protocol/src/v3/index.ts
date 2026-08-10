/**
 * V3 protocol — MotionProjectV3 root schema.
 *
 * Layout: `metadata` (identity) + `composition` (render surface) +
 * `capabilities` (preflight) + `dependencies` + `tokens`/`variables`/
 * `bindings` + `assets`/`components`/`scenes` + `timeline` (visual/audio/
 * caption tracks) + optional `provenance`/`extensions`.
 */
import { z } from "zod";
import { MOTION_V2_LIMITS } from "../capabilities";
import { MOTION_PROJECT_V3_FORMAT_VERSION } from "./common";
import { ProjectMetadataV3Schema } from "./metadata";
import { CompositionSettingsSchema } from "./composition";
import { ProjectCapabilityRequirementsSchema } from "./capabilities";
import { ProjectDependenciesV3Schema } from "./components";
import {
  DesignTokensSchema,
  ProjectBindingV3Schema,
  ProjectVariableV3Schema,
} from "./variables";
import { AssetV3Schema } from "./assets";
import { EmbeddedComponentV3Schema } from "./components";
import { SceneDefinitionV3Schema } from "./scenes";
import { ProjectTimelineV3Schema } from "./timeline";
import { NamespacedExtensionsSchema } from "./extensions";
import { ProjectProvenanceSchema } from "./provenance";

export const MotionProjectV3Schema = z
  .object({
    format: z.literal("motion-project"),
    formatVersion: z.literal(MOTION_PROJECT_V3_FORMAT_VERSION),
    metadata: ProjectMetadataV3Schema,
    composition: CompositionSettingsSchema,
    capabilities: ProjectCapabilityRequirementsSchema.default({}),
    dependencies: ProjectDependenciesV3Schema,
    tokens: DesignTokensSchema.default({}),
    variables: z
      .array(ProjectVariableV3Schema)
      .max(MOTION_V2_LIMITS.variablesPerArtifact)
      .default([]),
    assets: z
      .array(AssetV3Schema)
      .max(MOTION_V2_LIMITS.assetsPerArtifact)
      .default([]),
    components: z
      .array(EmbeddedComponentV3Schema)
      .max(MOTION_V2_LIMITS.dependenciesPerProject)
      .default([]),
    scenes: z
      .array(SceneDefinitionV3Schema)
      .max(MOTION_V2_LIMITS.scenesPerProject)
      .default([]),
    timeline: ProjectTimelineV3Schema,
    bindings: z
      .array(ProjectBindingV3Schema)
      .max(MOTION_V2_LIMITS.bindingsPerArtifact)
      .default([]),
    provenance: ProjectProvenanceSchema.optional(),
    extensions: NamespacedExtensionsSchema,
  })
  .strict();

export type MotionProjectV3 = z.infer<typeof MotionProjectV3Schema>;

export * from "./common";
export * from "./metadata";
export * from "./composition";
export * from "./capabilities";
export * from "./variables";
export * from "./assets";
export * from "./assets-types";
export * from "./components";
export * from "./scenes";
export * from "./timeline";
export * from "./extensions";
export * from "./provenance";
export * from "./migrations";
export * from "./nodes";
export * from "./animation";
