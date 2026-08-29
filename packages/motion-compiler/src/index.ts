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
  compileProtocolToPaintCommands,
  CompileProtocolToRuntimeV3Error,
  type CompileProtocolV3Options,
} from "./runtime-project-v3";
