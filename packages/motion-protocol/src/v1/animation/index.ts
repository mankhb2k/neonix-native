/**
 * Barrel animation V1 — easing / drivers / interpolation.
 *
 * Authoring layer/property animation lives on `timeline.clips`.
 */

// Easing
export {
  KeyframeEasingNamedSchema,
  KeyframeEasingCubicSchema,
  KeyframeEasingSpringSchema,
  KeyframeEasingSchema,
  type KeyframeEasingV1,
} from "./easing";

export { ProceduralDriverSchema, type ProceduralDriver } from "./drivers";

export {
  defaultInterpolationForValueKind,
  allowedInterpolationsForValueKind,
  type KeyframeInterpolationV1,
} from "./interpolation";
