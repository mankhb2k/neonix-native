/**
 * Controlled seek helper — maps client X to timeline time via metrics APIs.
 */

import { useCallback, type RefObject } from "react";
import { clientXToTimelineTime } from "@motionvideo/editor-interactions";

export type UseTimelineSeekArgs = {
  tracksScrollRef: RefObject<HTMLElement | null>;
  pixelsPerSecond: number;
  maxTime: number;
  minTime?: number;
  disabled?: boolean;
  onSeek: (time: number) => void;
};

export function useTimelineSeek({
  tracksScrollRef,
  pixelsPerSecond,
  maxTime,
  minTime = 0,
  disabled,
  onSeek,
}: UseTimelineSeekArgs): (clientX: number) => void {
  return useCallback(
    (clientX: number) => {
      const scroll = tracksScrollRef.current;
      if (!scroll || disabled) return;
      const time = clientXToTimelineTime(
        clientX,
        scroll,
        pixelsPerSecond,
        maxTime,
        minTime,
      );
      onSeek(time);
    },
    [
      disabled,
      maxTime,
      minTime,
      onSeek,
      pixelsPerSecond,
      tracksScrollRef,
    ],
  );
}
