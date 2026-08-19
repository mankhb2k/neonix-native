/**
 * Kiểu public V1 — core render atoms only.
 *
 * Session sugar (tokens, variables, bindings, audit) lives in AuthoringSugarV1 / envelope.
 */
import type { AssetV1 } from "./assets";
import type { CompositionSettings } from "./composition";
import type { ComponentDefinitionV1 } from "./components";
import type { LayerV1 } from "./layers";
import type { ProjectMetadataV1 } from "./metadata";

export type MotionProjectV1 = {
  format: "motion-project";
  formatVersion: 1;
  metadata: ProjectMetadataV1;
  composition: CompositionSettings;
  assets: AssetV1[];
  components: ComponentDefinitionV1[];
  layers: LayerV1[];
};
