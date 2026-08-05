/**
 * Layer-mode strip move — time (horizontal) + row reorder (vertical / zIndex).
 * Vertical reorder shows the same cyan insert line as track-mode lane insert.
 */

import { useCallback } from "react";
import {
  selectionNode,
  type DocumentPropertyCommand,
  type TimelineClip,
} from "@motionvideo/editor-core";
import type { PointerEvent as ReactPointerEvent } from "react";
import { autoScrollTimelineNearEdge } from "../drop/auto-scroll";
import {
  getTimelineDropHost,
  pointerContentXAtPoint,
} from "../drop/timeline-drop-host";
import type { BeginGesture } from "../interactions/use-pointer-session";
import { setClipMovePreview } from "../interactions/timeline-preview-session";
import { clampNodeLocalTiming } from "../layer-mode/build-layer-mode-view";
import {
  reorderLayerNodeIdsByInsert,
  resolveLayerInsertGapAtClientY,
} from "../layer-mode/layer-row-reorder";

const DRAG_THRESHOLD_PX = 4;
const MIN_LAYER_DURATION_SEC = 0.05;

export type LayerMoveSession = {
  sceneId: string;
  containerStart: number;
  containerDuration: number;
  /** Node ids top→bottom (matches layer lane rows). */
  orderedNodeIds: string[];
  /** Lane ids top→bottom parallel to orderedNodeIds. */
  orderedLaneIds: string[];
  /** Video source duration cap (seconds) by node id. */
  mediaMaxDurationByNodeId?: ReadonlyMap<string, number>;
};

type Args = {
  pixelsPerSecond: number;
  disabled?: boolean;
  /** Lane body height for floating bubble (layer compact / video). */
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

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export function useLayerMove({
  pixelsPerSecond,
  disabled,
  laneHeightPx = 24,
  layerSession,
  beginGesture,
  onSelect,
  onExecuteProperty,
}: Args) {
  const pps = Math.max(pixelsPerSecond, 0.001);

  const beginLayerMove = useCallback(
    (event: ReactPointerEvent, clip: TimelineClip) => {
      if (!layerSession || disabled || event.button !== 0) return;
      if (!onExecuteProperty) return;
      event.preventDefault();
      event.stopPropagation();
      onSelect(selectionNode(layerSession.sceneId, clip.id));

      const originDuration = clip.duration;
      const originX = event.clientX;
      const originY = event.clientY;
      const originLaneId = clip.laneId;
      const clipRect = (
        event.currentTarget as HTMLElement
      ).getBoundingClientRect();
      const grabOffsetY = Math.max(
        0,
        Math.min(laneHeightPx * 0.96, originY - clipRect.top),
      );
      const originContentX = pointerContentXAtPoint(event.clientX) ?? originX;
      const grabOffsetSec = Math.max(
        0,
        Math.min(originDuration, originContentX / pps - clip.startTime),
      );
      const {
        containerStart,
        containerDuration,
        sceneId,
        orderedNodeIds,
      } = layerSession;
      const originIndex = orderedNodeIds.indexOf(clip.id);
      /** Home gap = "before self" — line hidden until a different gap is chosen. */
      const homeInsertBefore = originIndex >= 0 ? originIndex : 0;

      type MoveState = {
        startTime: number;
        duration: number;
        laneId: string;
        insertBeforeIndex: number;
        moved: boolean;
        timingChanged: boolean;
        orderChanged: boolean;
        contentTop: number | null;
      };

      beginGesture<MoveState, void>(
        {
          name: "layer-move",
          onStart: () => ({
            startTime: clip.startTime,
            duration: clip.duration,
            laneId: originLaneId,
            insertBeforeIndex: homeInsertBefore,
            moved: false,
            timingChanged: false,
            orderChanged: false,
            contentTop: null,
          }),
          onUpdate: (pos, state) => {
            const dx = pos.x - originX;
            const dy = pos.y - originY;
            if (
              !state.moved &&
              dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX
            ) {
              return state;
            }

            autoScrollTimelineNearEdge(pos.x, pos.y);

            const contentX = pointerContentXAtPoint(pos.x) ?? originContentX;
            const proposedStart = contentX / pps - grabOffsetSec;
            const localStart = proposedStart - containerStart;
            const nextTiming = clampNodeLocalTiming(
              localStart,
              originDuration,
              containerDuration,
              MIN_LAYER_DURATION_SEC,
            );
            const globalStart = containerStart + nextTiming.start;

            const host = getTimelineDropHost();
            let insertBeforeIndex = homeInsertBefore;
            let contentTop: number | null = null;
            let targetLaneId = originLaneId;
            if (host?.laneHitLayout) {
              const gap = resolveLayerInsertGapAtClientY(
                host.scrollEl,
                pos.y,
                host.lanes,
                host.laneHitLayout,
              );
              if (gap) {
                insertBeforeIndex = gap.insertBeforeIndex;
                contentTop = gap.contentTop;
                targetLaneId = gap.laneId;
              }
            }

            const nextOrder = reorderLayerNodeIdsByInsert(
              orderedNodeIds,
              clip.id,
              insertBeforeIndex,
            );
            const orderChanged = !sameOrder(nextOrder, orderedNodeIds);
            const timingChanged =
              Math.abs(globalStart - clip.startTime) > 1e-4 ||
              Math.abs(nextTiming.duration - clip.duration) > 1e-4;

            setClipMovePreview({
              clipId: clip.id,
              originLaneId,
              laneId: targetLaneId,
              startTime: globalStart,
              duration: nextTiming.duration,
              valid: true,
              trackKind: "overlay",
              label: clip.name || clip.id,
              clientX: pos.x,
              clientY: pos.y,
              grabOffsetY,
              laneHeightPx,
              /** Cyan insert line only while reordering rows (vertical). */
              isInsert: orderChanged,
              contentTop: orderChanged ? (contentTop ?? undefined) : undefined,
            });

            return {
              startTime: globalStart,
              duration: nextTiming.duration,
              laneId: targetLaneId,
              insertBeforeIndex,
              moved: true,
              timingChanged,
              orderChanged,
              contentTop,
            };
          },
          onCommit: (state) => {
            setClipMovePreview(null);
            if (!state.moved) return;

            if (state.timingChanged) {
              const localStart = state.startTime - containerStart;
              const clamped = clampNodeLocalTiming(
                localStart,
                state.duration,
                containerDuration,
                MIN_LAYER_DURATION_SEC,
              );
              onExecuteProperty({
                command: {
                  type: "set-node-timing",
                  targets: [{ sceneId, nodeId: clip.id }],
                  timing: clamped,
                },
                label: "Move layer",
                coalesceKey: `node-timing:${sceneId}:${clip.id}`,
              });
            }

            if (state.orderChanged) {
              const nextOrder = reorderLayerNodeIdsByInsert(
                orderedNodeIds,
                clip.id,
                state.insertBeforeIndex,
              );
              if (!sameOrder(nextOrder, orderedNodeIds)) {
                onExecuteProperty({
                  command: {
                    type: "reorder-scene-nodes",
                    sceneId,
                    nodeIds: nextOrder,
                  },
                  label: "Reorder layers",
                  coalesceKey: `node-reorder:${sceneId}`,
                });
              }
            }
          },
          onCancel: () => {
            setClipMovePreview(null);
          },
        },
        { x: event.clientX, y: event.clientY },
        event.currentTarget as HTMLElement,
        event.pointerId,
      );
    },
    [
      beginGesture,
      disabled,
      laneHeightPx,
      layerSession,
      onExecuteProperty,
      onSelect,
      pps,
    ],
  );

  return { beginLayerMove };
}
