/**
 * Desktop track-kind adapter — re-exports from editor-core.
 */

export {
  resolveLaneTrackKind,
  type TimelineTrackKind,
} from "@motionvideo/editor-core";

/**
 * @deprecated Use resolveLaneTrackKind directly.
 */
export { resolveLaneTrackKind as trackForLane } from "@motionvideo/editor-core";
