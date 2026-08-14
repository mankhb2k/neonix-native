/**
 * V1 protocol — MotionProjectV1 re-exports.
 *
 * The root schema lives in ./project (leaf module, no barrel cycle)
 * so mcp, patch, and parse can import it without circular deps.
 */
export {
  MotionProjectV1Schema,
  CanonicalMotionProjectV1Schema,
  type MotionProjectV1,
  type CanonicalMotionProjectV1,
} from "./project";

export * from "./common";
export * from "./metadata";
export * from "./composition";
export * from "./capabilities";
export * from "./variables";
export * from "./assets";
export * from "./assets-types";
export * from "./components";
export * from "./prop-values";
export * from "./timeline";
export * from "./extensions";
export * from "./provenance";
export * from "./references";
export * from "./parse";
export * from "./layers";
export * from "./animation";
export * from "./canonical-hash";
export * from "./patch";
export * from "./mcp";
