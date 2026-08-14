/**
 * Compiler / renderer IR — import `@motionvideo/motion-protocol/runtime`.
 *
 * Authoring JSON stays on `@motionvideo/motion-protocol`.
 */

export * from "./assets";

export {
  MotionRuntimeProjectSchema,
  RuntimeCompositionMetadataSchema,
  RuntimeSourceRefSchema,
  RuntimeSourceRefMapSchema,
  RuntimeLayerGraphSchema,
  RuntimeSceneSchema,
  PlatformSafeAreaSchema,
  ProjectMetadataSchema,
  MOTION_RUNTIME_VERSION,
  type MotionRuntimeProject,
  type MotionRuntimeTrack,
  type RuntimeCompositionMetadata,
  type RuntimeSourceRef,
  type RuntimeSourceRefMap,
  type RuntimeLayerGraph,
  type RuntimeScene,
  type PlatformSafeArea,
  type ProjectMetadata,
} from "./project";

export {
  type PreparedRuntimeProject,
  type RuntimeVisualLayer,
  type RuntimePropertyTrack,
  type RuntimeSceneNode,
  type RuntimeSceneTrack,
  type StaticGeometry,
  type TextLayoutInput,
  type CompositingScope,
  type DepGraphNode,
} from "./prepared";
