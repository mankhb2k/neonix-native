/**
 * Web adapter — wraps useClipMove from editor-react, supplies a simple
 * ClipMoveHost that keeps clips in their original lane (no cross-lane move yet).
 */

import { useMemo, type RefObject } from "react";
import {
  useClipMove as useClipMoveShared,
  type BeginGesture,
  type ClipMoveHost,
} from "@motionvideo/editor-react";
import {
  resolveLaneTrackKind,
  type EditorSelection,
  type TimelineClip,
  type TimelineCommand,
  type TimelineLane,
} from "@motionvideo/editor-core";
import {
  computeAutoScrollNearEdge,
  type ClipMovePreview,
} from "@motionvideo/editor-interactions";

export type UseClipMoveArgs = {
  clips: TimelineClip[];
  allClips?: TimelineClip[];
  lanes: TimelineLane[];
  lane: TimelineLane;
  pixelsPerSecond: number;
  selection: EditorSelection;
  disabled?: boolean;
  beginGesture: BeginGesture;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (command: TimelineCommand, label: string) => void;
  onMovePreview: (preview: ClipMovePreview | null) => void;
  scrollRef: RefObject<HTMLElement | null>;
};

export function useClipMove({
  clips,
  allClips,
  lanes,
  lane,
  pixelsPerSecond,
  selection,
  disabled,
  beginGesture,
  onSelect,
  onExecute,
  onMovePreview,
  scrollRef,
}: UseClipMoveArgs) {
  const host: ClipMoveHost = useMemo(
    () => ({
      autoScrollNearEdge: (clientX: number, clientY: number) => {
        const el = scrollRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const delta = computeAutoScrollNearEdge({
          clientX,
          clientY,
          viewport: {
            clientLeft: rect.left,
            clientTop: rect.top,
            clientWidth: el.clientWidth,
            clientHeight: el.clientHeight,
            scrollLeft: el.scrollLeft,
            scrollTop: el.scrollTop,
            scrollWidth: el.scrollWidth,
            scrollHeight: el.scrollHeight,
            tracksOriginX: 0,
          },
        });
        if (delta.scrollLeftDelta !== 0) {
          el.scrollLeft = delta.nextScrollLeft;
        }
        if (delta.scrollTopDelta !== 0) {
          el.scrollTop = delta.nextScrollTop;
        }
      },

      pointerContentXAtPoint: (clientX: number): number | null => {
        const el = scrollRef.current;
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return clientX - rect.left + el.scrollLeft;
      },

      getDropContext: () => {
        const el = scrollRef.current;
        if (!el) return null;
        return {
          scrollEl: el,
          lanes,
          clipsByLane: undefined,
        };
      },

      /** Same-lane only for now — cross-lane deferred. */
      resolveDropAtY: () => null,

      trackForLane: resolveLaneTrackKind,

      laneRowHeightPx: () => 36,
    }),
    [scrollRef, lanes],
  );

  return useClipMoveShared({
    clips,
    allClips,
    lanes,
    lane,
    pixelsPerSecond,
    selection,
    disabled,
    beginGesture,
    onSelect,
    onCommand: onExecute,
    onMovePreview,
    host,
  });
}
