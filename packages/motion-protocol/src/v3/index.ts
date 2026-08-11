/**
 * V3 protocol — MotionProjectV3 re-exports.
 *
 * The root schema lives in ./project (leaf module, no barrel cycle)
 * so mcp, patch, parse, and skills can import it without circular deps.
 */
export { MotionProjectV3Schema, type MotionProjectV3 } from "./project";

export * from "./common";
export * from "./metadata";
export * from "./composition";
export * from "./capabilities";
export * from "./variables";
export * from "./assets";
export * from "./assets-types";
export * from "./components";
export * from "./scenes";
export * from "./timeline";
export * from "./extensions";
export * from "./provenance";
export * from "./references";
export * from "./parse";
export * from "./nodes";
export * from "./animation";
export * from "./canonical-hash";
export * from "./patch";
export * from "./skills";
export * from "./mcp";
