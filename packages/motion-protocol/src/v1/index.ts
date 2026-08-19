/**
 * Barrel protocol V1 — re-export MotionProjectV1.
 *
 * Schema gốc nằm ở ./project (module lá, không vòng barrel)
 * để mcp / patch / parse import được mà không circular.
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
export * from "./opacity";
export * from "./assets";
export * from "./assets/validation";
export * from "./components";
export * from "./references";
export * from "./parse";
export * from "../sugar";
export * from "./normalize-authoring";
export * from "./frame";
export * from "./transform";
export * from "./compositing";
export * from "./effects";
export * from "./layer-atoms";
export * from "./layers";
export * from "./animation";
export * from "./canonical-hash";
export * from "./patch";
export * from "./mcp";
