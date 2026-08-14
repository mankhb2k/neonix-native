/**
 * Compiler / renderer IR — import `@motionvideo/motion-protocol/runtime`.
 *
 * Authoring JSON stays on `@motionvideo/motion-protocol`.
 */

export * from "./assets";

export {
  MotionRuntimeProjectSchema,
  RuntimeCompositionMetadataSchema,
  RuntimeClipSourceSchema,
  RuntimeVisualClipSchema,
  RuntimeVisualTrackSchema,
  RuntimeSourceRefSchema,
  RuntimeSourceRefMapSchema,
  RuntimeLayerGraphSchema,
  RuntimeSceneSchema,
  PlatformSafeAreaSchema,
  ProjectMetadataSchema,
  AudioTrackSchema,
  SceneTransitionSchema,
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
  type RuntimeLayerGraph,
  type RuntimeScene,
  type PlatformSafeArea,
  type ProjectMetadata,
  type AudioTrack,
  type SceneTransition,
} from "./project";

export type { MotionRuntimeScene as MotionScene } from "./project";

export {
  type PreparedRuntimeProject,
  type RuntimeSceneNode,
  type RuntimeSceneTrack,
  type StaticGeometry,
  type TextLayoutInput,
  type CompositingScope,
  type DepGraphNode,
} from "./prepared";
