/**
 * Canonical compiler public API.
 *
 * Protocol V2 remains the authoring boundary. compileProtocol() emits the
 * canonical RuntimeProjectV3. V2 names are explicit compatibility shims only.
 */
export {
  compileProtocolV2,
  compileProtocolV2ToPaintCommands,
  type CompileProtocolOptions,
  type CompileProtocolV2Options,
} from "./compiler";
export {
  compileProtocol,
  compileProtocolToPaintCommands,
  compileProtocolToRuntimeV3,
  compileProtocolV2ToRuntimeV3,
  CompileProtocolToRuntimeV3Error,
  CompileProtocolV2ToRuntimeV3Error,
  type CompileProtocolV3Options,
} from "./runtime-project-v3";
