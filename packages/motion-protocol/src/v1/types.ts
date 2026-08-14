/**
 * Kiểu public V1.
 *
 * Aggregate MotionProjectV1 viết tay để Zod không buộc TS bung type khổng lồ.
 */
import type { AssetV1 } from "./assets";
import type { ProjectCapabilityRequirements } from "./capabilities";
import type { CompositionSettings } from "./composition";
import type { DesignTokens } from "./design-tokens";
import type {
  ComponentDefinitionV1,
  ProjectDependenciesV1,
} from "./components";
import type { NamespacedExtensions } from "./extensions";
import type { LayerV1 } from "./layers";
import type { ProjectMetadataV1 } from "./metadata";
import type { ProjectProvenance } from "./provenance";
import type { ProjectTimelineV1 } from "./timeline/schema";
import type { ProjectBindingV1, ProjectVariableV1 } from "./variables";

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
  layers: LayerV1[];
  timeline: ProjectTimelineV1;
  bindings: ProjectBindingV1[];
  provenance?: ProjectProvenance;
  extensions: NamespacedExtensions;
};
