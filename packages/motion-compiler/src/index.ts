/**
 * Canonical compiler public API.
 *
 * Protocol V2 remains the authoring boundary. compileProtocol() emits the
 * canonical RuntimeProjectV3. No Runtime V2 compiler entrypoint is public.
 */
export {
  compileVisualProject,
  type CompileProtocolOptions,
} from "./compiler";
export {
  compileProtocol,
  compileProtocolAtTime,
  compileProtocolToPaintCommands,
  CompileProtocolToRuntimeV3Error,
  type CompileProtocolV3Options,
} from "./runtime-project-v3";
export {
  COMPILER_SUPPORTED_FEATURES,
  COMPILER_SUPPORTED_FEATURES_VERSION,
  isCompilerFeatureSupported,
  type CompilerSupportedFeature,
} from "./compiler/capabilities";
export {
  sampleMotionLayerAtTime,
  sampleMotionProtocolAtTime,
} from "./animation/sampler";
