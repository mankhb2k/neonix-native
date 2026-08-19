/**
 * Editor session sugar — not part of core MotionProjectV1 on disk.
 * Web envelope / expand pipeline holds these fields.
 */
import type { V1 } from "@motionvideo/motion-protocol";
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
  tokens?: Record<string, Record<string, unknown>>;
  variables?: ProjectVariableV1[];
  bindings?: ProjectBindingV1[];
  capabilities?: { required?: string[]; optional?: string[]; experimental?: string[] };
  dependencies?: V1.ProjectDependenciesV1;
  provenance?: ProjectProvenance;
  extensions?: NamespacedExtensions;
  layerDisplayNames?: Record<string, string>;
  propSemantics?: Record<string, Record<string, string>>;
};
