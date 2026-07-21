import type { MotionBlock } from "../types";
import { TEXT_HIGHLIGHT } from "../text";

/**
 * Emphasis — attention while on screen.
 * Text-owned blocks (e.g. highlight) are re-indexed here for the shelf view.
 */
export const EMPHASIS_BLOCKS: MotionBlock[] = [TEXT_HIGHLIGHT];

/** Planned: pulse, shake, flash, wiggle (generic); jelly/rubber-band later */
