/**
 * Desktop adapter — wires controlled marquee hooks to timeline preview session.
 */
import { useCallback, type RefObject, type PointerEvent as ReactPointerEvent } from "react";
import type { EditorSelection, TimelineClip, TimelineLane } from "@motionvideo/editor-core";
import {
  useTimelineMarquee as useTimelineMarqueeShared,
  type BeginGesture,
} from "@motionvideo/editor-react";
import {
  setMarquee,
  setMarqueeSelectionIds,
} from "../interactions/timeline-preview-session";

type Args = {
  tracksScrollRef: RefObject<HTMLDivElement | null>;
  disabled: boolean | undefined;
  selection: EditorSelection;
  beginGesture: BeginGesture;
  laneHeightPrefix: number[];
  laneContentHeights: number[];
  topPadding: number;
  sortedLanes: TimelineLane[];
  clipsByLaneMap: Map<string, TimelineClip[]>;
  pixelsPerSecond: number;
  onSelect: (selection: EditorSelection) => void;
  seekToClientX: (clientX: number) => void;
};

export function useTimelineMarquee(args: Args): (
  event: ReactPointerEvent<HTMLDivElement>,
) => void {
  return useTimelineMarqueeShared({
    ...args,
    onMarqueeRect: useCallback((rect) => setMarquee(rect), []),
    onMarqueeSelectionIds: useCallback(
      (ids) => setMarqueeSelectionIds(ids),
      [],
    ),
  });
}
