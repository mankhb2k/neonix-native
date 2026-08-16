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
  ProjectMetadataSchema,
  MOTION_RUNTIME_VERSION,
  type MotionRuntimeProject,
  type MotionRuntimePropertyAnimation,
  type RuntimeCompositionMetadata,
  type RuntimeSourceRef,
  type RuntimeSourceRefMap,
  type RuntimeLayerGraph,
  type ProjectMetadata,
} from "./project";

export {
  type PreparedRuntimeProject,
  type RuntimeVisualLayer,
  type RuntimePropertyAnimation,
  type StaticGeometry,
  type TextLayoutInput,
  type CompositingScope,
  type DepGraphNode,
} from "./prepared";
