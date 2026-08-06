/**
 * Desktop adapter — layer move host + preview session.
 */

import { useMemo } from "react";
import {
  useLayerMove as useLayerMoveShared,
  type BeginGesture,
  type LayerMoveHost,
  type LayerMoveSession,
} from "@motionvideo/editor-react";
import {
  selectionNode,
  type DocumentPropertyCommand,
} from "@motionvideo/editor-core";
import { autoScrollTimelineNearEdge } from "../drop/auto-scroll";
import {
  getTimelineDropHost,
  pointerContentXAtPoint,
} from "../drop/timeline-drop-host";
import { setClipMovePreview } from "../interactions/timeline-preview-session";
import { resolveLayerInsertGapAtClientY } from "../layer-mode/layer-row-reorder";

export type { LayerMoveSession };

type Args = {
  pixelsPerSecond: number;
  disabled?: boolean;
  laneHeightPx?: number;
  layerSession: LayerMoveSession | null;
  beginGesture: BeginGesture;
  onSelect: (selection: ReturnType<typeof selectionNode>) => void;
  onExecuteProperty?: (input: {
    command: DocumentPropertyCommand;
    label: string;
    coalesceKey?: string;
  }) => void;
};

const desktopLayerMoveHost: LayerMoveHost = {
  autoScrollNearEdge: autoScrollTimelineNearEdge,
  pointerContentXAtPoint,
  resolveInsertGapAtClientY: (clientY) => {
    const host = getTimelineDropHost();
    if (!host?.laneHitLayout) return null;
    return resolveLayerInsertGapAtClientY(
      host.scrollEl,
      clientY,
      host.lanes,
      host.laneHitLayout,
    );
  },
};

export function useLayerMove(args: Args) {
  const onMovePreview = useMemo(() => setClipMovePreview, []);
  return useLayerMoveShared({
    ...args,
    host: desktopLayerMoveHost,
    onCommandProperty: args.onExecuteProperty,
    onMovePreview,
  });
}
