/**
 * PreparedRuntimeProject — compiled runtime IR with precomputed indexes.
 *
 * The types currently live in 2/prepared-runtime.ts. Phase 8 will
 * invert this and delete the V2 copy.
 */
export {
  type PreparedRuntimeProject,
  type RuntimeSceneNode,
  type RuntimeSceneTrack,
  type RuntimeScene,
  type StaticGeometry,
  type TextLayoutInput,
  type CompositingScope,
  type DepGraphNode,
} from "../v2/prepared-runtime";
