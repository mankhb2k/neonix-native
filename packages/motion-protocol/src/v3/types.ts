/**
 * V3 public protocol types.
 *
 * Keep root aggregate types here so large Zod schemas do not force
 * TypeScript to serialize enormous inferred types in schema modules.
 */
import type { AssetV3 } from "./assets";
import type { ProjectCapabilityRequirements } from "./capabilities";
import type { CompositionSettings } from "./composition";
import type { EmbeddedComponentV3, ProjectDependenciesV3 } from "./components";
import type { NamespacedExtensions } from "./extensions";
import type { ProjectMetadataV3 } from "./metadata";
import type { ProjectProvenance } from "./provenance";
import type { SceneDefinitionV3 } from "./scenes";
import type { ProjectTimelineV3 } from "./timeline/schema";
import type {
  DesignTokens,
  ProjectBindingV3,
  ProjectVariableV3,
} from "./variables";

export type MotionProjectV3 = {
  format: "motion-project";
  formatVersion: 3;
  metadata: ProjectMetadataV3;
  composition: CompositionSettings;
  capabilities: ProjectCapabilityRequirements;
  dependencies: ProjectDependenciesV3;
  tokens: DesignTokens;
  variables: ProjectVariableV3[];
  assets: AssetV3[];
  components: EmbeddedComponentV3[];
  scenes: SceneDefinitionV3[];
  timeline: ProjectTimelineV3;
  bindings: ProjectBindingV3[];
  provenance?: ProjectProvenance;
  extensions: NamespacedExtensions;
};
