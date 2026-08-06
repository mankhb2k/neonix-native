/**
 * Desktop adapter — wires clip-move host + preview session + snap prefs.
 */

import { useMemo } from "react";
import {
  useClipMove as useClipMoveShared,
  type BeginGesture,
  type ClipMoveHost,
} from "@motionvideo/editor-react";
import type {
  EditorSelection,
  TimelineClip,
  TimelineCommand,
  TimelineLane,
} from "@motionvideo/editor-core";
import { autoScrollTimelineNearEdge } from "../drop/auto-scroll";
import { resolveClipMoveDropAtY } from "../drop/lane-drop-target";
import {
  getTimelineDropHost,
  pointerContentXAtPoint,
} from "../drop/timeline-drop-host";
import { setClipMovePreview } from "../interactions/timeline-preview-session";
import { trackForLane } from "../lanes/track-kind";
import { laneRowHeightPx } from "../timeline-scale";
import { useTimelineInteractionPrefs } from "../timeline-interaction-prefs";

export type UseClipMoveArgs = {
  clips: TimelineClip[];
  allClips?: TimelineClip[];
  lanes: TimelineLane[];
  lane: TimelineLane;
  laneHeightPx?: number;
  pixelsPerSecond: number;
  selection: EditorSelection;
  disabled?: boolean;
  beginGesture: BeginGesture;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (command: TimelineCommand, label: string) => void;
};

const desktopClipMoveHost: ClipMoveHost = {
  autoScrollNearEdge: autoScrollTimelineNearEdge,
  pointerContentXAtPoint,
  getDropContext: () => {
    const host = getTimelineDropHost();
    if (!host) return null;
    return {
      scrollEl: host.scrollEl,
      lanes: host.lanes,
      clipsByLane: host.clipsByLane,
      siblingLaneRefs: host.siblingLaneRefs,
      overlayLaneRefs: host.overlayLaneRefs,
      audioLaneRefs: host.audioLaneRefs,
      laneHitLayout: host.laneHitLayout,
    };
  },
  resolveDropAtY: resolveClipMoveDropAtY,
  trackForLane,
  laneRowHeightPx,
};

export function useClipMove(args: UseClipMoveArgs) {
  const autoSnapping = useTimelineInteractionPrefs((s) => s.autoSnapping);
  const onMovePreview = useMemo(() => setClipMovePreview, []);

  return useClipMoveShared({
    ...args,
    autoSnapping,
    host: desktopClipMoveHost,
    onCommand: args.onExecute,
    onMovePreview,
  });
}
