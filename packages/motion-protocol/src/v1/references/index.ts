/**
 * Barrel kiểm tra reference V1.
 */
export { validateMotionProjectV1References } from "./project";
export { validateLayerGraphV1 } from "./layer-graph";
export { validateLayerAssetsV1 } from "./layer-assets";
export { MotionV1ReferenceError } from "./types";
export type { ReferenceIssue } from "./types";
export {
  assetValidationIssue,
  type AssetValidationIssue,
  type AssetValidationCode,
  type AssetValidationLayer,
} from "../assets/validation";
