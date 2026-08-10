/**
 * V3 easing — re-exported from v2 (unchanged semantics).
 */
import { z } from "zod";
import { KeyframeEasingV2Schema } from "../../v2/animation/easing";
export {
  KeyframeEasingNamedSchema,
  KeyframeEasingCubicSchema,
  KeyframeEasingSpringSchema,
  KeyframeEasingV2Schema,
} from "../../v2/animation/easing";

export type KeyframeEasingV3 = z.infer<typeof KeyframeEasingV2Schema>;
