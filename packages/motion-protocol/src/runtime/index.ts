/**
 * Canonical runtime IR types — neutral location, no legacy naming.
 *
 * Core exports:
 *   - MotionRuntimeProjectSchema / MotionRuntimeProject
 *   - Sub-schemas (RuntimeCompositionMetadataSchema, RuntimeVisualClipSchema, …)
 *   - PreparedRuntimeProject (in-memory compilation target)
 *   - Sub-types (RuntimeSceneNode, RuntimeSceneTrack, StaticGeometry, …)
 */

export {
  MotionRuntimeProjectSchema,
  RuntimeCompositionMetadataSchema,
  RuntimeClipSourceSchema,
  RuntimeVisualClipSchema,
  RuntimeVisualTrackSchema,
  RuntimeSourceRefSchema,
  RuntimeSourceRefMapSchema,
  MOTION_RUNTIME_VERSION,
  type MotionRuntimeProject,
  type MotionRuntimeScene,
  type MotionRuntimeTrack,
  type RuntimeCompositionMetadata,
  type RuntimeClipSource,
  type RuntimeVisualClip,
  type RuntimeVisualTrack,
  type RuntimeSourceRef,
  type RuntimeSourceRefMap,
} from "./project";

export {
  type PreparedRuntimeProject,
  type RuntimeSceneNode,
  type RuntimeSceneTrack,
  type RuntimeScene,
  type StaticGeometry,
  type TextLayoutInput,
  type CompositingScope,
  type DepGraphNode,
} from "./prepared";
