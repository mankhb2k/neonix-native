/**
 * V1 public protocol types.
 *
 * Keep root aggregate types here so large Zod schemas do not force
 * TypeScript to serialize enormous inferred types in schema modules.
 */
import type { AssetV1 } from "./assets";
import type { ProjectCapabilityRequirements } from "./capabilities";
import type { CompositionSettings } from "./composition";
import type {
  ComponentDefinitionV1,
  ProjectDependenciesV1,
} from "./components";
import type { NamespacedExtensions } from "./extensions";
import type { ProjectMetadataV1 } from "./metadata";
import type { ProjectProvenance } from "./provenance";
import type { SceneDefinitionV1 } from "./scenes";
import type { ProjectTimelineV1 } from "./timeline/schema";
import type {
  DesignTokens,
  ProjectBindingV1,
  ProjectVariableV1,
} from "./variables";

export type MotionProjectV1 = {
  format: "motion-project";
  formatVersion: 1;
  metadata: ProjectMetadataV1;
  composition: CompositionSettings;
  capabilities: ProjectCapabilityRequirements;
  dependencies: ProjectDependenciesV1;
  tokens: DesignTokens;
  variables: ProjectVariableV1[];
  assets: AssetV1[];
  components: ComponentDefinitionV1[];
  scenes: SceneDefinitionV1[];
  timeline: ProjectTimelineV1;
  bindings: ProjectBindingV1[];
  provenance?: ProjectProvenance;
  extensions: NamespacedExtensions;
};
