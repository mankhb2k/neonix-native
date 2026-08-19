/**
 * Editor session sugar — not part of core MotionProjectV1 on disk.
 * Web envelope / expand pipeline holds these fields.
 */
import type { ProjectCapabilityRequirements } from "./capabilities";
import type { ProjectDependenciesV1 } from "./components";
import type { DesignTokens } from "./design-tokens";
import type { NamespacedExtensions } from "./extensions";
import type { ProjectProvenance } from "./provenance";
import type { ProjectBindingV1, ProjectVariableV1 } from "./variables";

export type ProjectMetadataExtrasV1 = {
  description?: string;
  industry?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type AuthoringSugarV1 = {
  metadataExtras?: ProjectMetadataExtrasV1;
  tokens?: DesignTokens;
  variables?: ProjectVariableV1[];
  bindings?: ProjectBindingV1[];
  capabilities?: ProjectCapabilityRequirements;
  dependencies?: ProjectDependenciesV1;
  provenance?: ProjectProvenance;
  extensions?: NamespacedExtensions;
  layerDisplayNames?: Record<string, string>;
  propSemantics?: Record<string, Record<string, string>>;
};
