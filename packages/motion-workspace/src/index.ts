/**
 * MotionWorkspace — multi-file authoring toolkit.
 *
 * Phase 10: Workspace manifest, reader, linker, and canonicalizer.
 *
 * This package produces canonical MotionProjectV1 bundles from
 * multi-file workspace layouts. It is a BUILD-TIME tool only —
 * runtime and renderers must never import this package.
 */
export {
  MotionWorkspaceManifestSchema,
  MOTION_WORKSPACE_FORMAT_VERSION,
  MODULE_NAME_REGEX,
  ModuleRefSchema,
  type ModuleRef,
  type MotionWorkspaceManifest,
} from "./schema";

export {
  MemoryWorkspaceReader,
  type MotionWorkspaceReader,
  type WorkspaceModule,
} from "./reader";

export {
  linkMotionWorkspace,
  type LinkDiagnostic,
  type LinkResult,
} from "./linker";
