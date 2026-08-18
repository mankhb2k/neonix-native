/**
 * Layer-mode strip move — time + row reorder. Controlled preview/command.
 */

import { useCallback } from "react";
import {
  selectionNode,
  type DocumentPropertyCommand,
  type TimelineClip,
} from "@motionvideo/editor-core";
import {
  clampNodeLocalTiming,
  reorderLayerLayerIdsByInsert,
  type ClipMovePreview,
} from "@motionvideo/editor-interactions";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { BeginGesture } from "../pointer/use-pointer-session-host";
import type { LayerMoveHost } from "./gesture-host";

const DRAG_THRESHOLD_PX = 4;
const MIN_LAYER_DURATION_SEC = 0.05;

export type LayerMoveSession = {
  sceneId: string;
  containerStart: number;
  containerDuration: number;
  orderedLayerIds: string[];
  orderedLaneIds: string[];
  mediaMaxDurationByNodeId?: ReadonlyMap<string, number>;
};

export type UseLayerMoveArgs = {
  pixelsPerSecond: number;
  disabled?: boolean;
  laneHeightPx?: number;
  layerSession: LayerMoveSession | null;
  beginGesture: BeginGesture;
  host: LayerMoveHost;
  onSelect: (selection: ReturnType<typeof selectionNode>) => void;
  onCommandProperty?: (input: {
    command: DocumentPropertyCommand;
    label: string;
    coalesceKey?: string;
  }) => void;
  onMovePreview: (preview: ClipMovePreview | null) => void;
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
  host,
  onSelect,
  onCommandProperty,
  onMovePreview,
}: UseLayerMoveArgs) {
  const pps = Math.max(pixelsPerSecond, 0.001);

  const beginLayerMove = useCallback(
    (event: ReactPointerEvent, clip: TimelineClip) => {
      if (!layerSession || disabled || event.button !== 0) return;
      if (!onCommandProperty) return;
      event.preventDefault();
      event.stopPropagation();
      onSelect(selectionNode(clip.id));

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
      const originContentX =
        host.pointerContentXAtPoint(event.clientX) ?? originX;
      const grabOffsetSec = Math.max(
        0,
        Math.min(originDuration, originContentX / pps - clip.startTime),
      );
      const { containerStart, containerDuration, sceneId, orderedLayerIds } =
        layerSession;
      const originIndex = orderedLayerIds.indexOf(clip.id);
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

            host.autoScrollNearEdge(pos.x, pos.y);

            const contentX =
              host.pointerContentXAtPoint(pos.x) ?? originContentX;
            const proposedStart = contentX / pps - grabOffsetSec;
            const localStart = proposedStart - containerStart;
            const nextTiming = clampNodeLocalTiming(
              localStart,
              originDuration,
              containerDuration,
              MIN_LAYER_DURATION_SEC,
            );
            const globalStart = containerStart + nextTiming.start;

            let insertBeforeIndex = homeInsertBefore;
            let contentTop: number | null = null;
            let targetLaneId = originLaneId;
            const gap = host.resolveInsertGapAtClientY(pos.y);
            if (gap) {
              insertBeforeIndex = gap.insertBeforeIndex;
              contentTop = gap.contentTop;
              targetLaneId = gap.laneId;
            }

            const nextOrder = reorderLayerLayerIdsByInsert(
              orderedLayerIds,
              clip.id,
              insertBeforeIndex,
            );
            const orderChanged = !sameOrder(nextOrder, orderedLayerIds);
            const timingChanged =
              Math.abs(globalStart - clip.startTime) > 1e-4 ||
              Math.abs(nextTiming.duration - clip.duration) > 1e-4;

            onMovePreview({
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
            onMovePreview(null);
            if (!state.moved) return;

            if (state.timingChanged) {
              const localStart = state.startTime - containerStart;
              const clamped = clampNodeLocalTiming(
                localStart,
                state.duration,
                containerDuration,
                MIN_LAYER_DURATION_SEC,
              );
              onCommandProperty({
                command: {
                  type: "set-node-timing",
                  targets: [{ sceneId, layerId: clip.id }],
                  timing: clamped,
                },
                label: "Move layer",
                coalesceKey: `node-timing:${sceneId}:${clip.id}`,
              });
            }

            if (state.orderChanged) {
              const nextOrder = reorderLayerLayerIdsByInsert(
                orderedLayerIds,
                clip.id,
                state.insertBeforeIndex,
              );
              if (!sameOrder(nextOrder, orderedLayerIds)) {
                onCommandProperty({
                  command: {
                    type: "reorder-scene-layers",
                    sceneId,
                    layerIds: nextOrder,
                  },
                  label: "Reorder layers",
                  coalesceKey: `node-reorder:${sceneId}`,
                });
              }
            }
          },
          onCancel: () => {
            onMovePreview(null);
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
      host,
      laneHeightPx,
      layerSession,
      onCommandProperty,
      onMovePreview,
      onSelect,
      pps,
    ],
  );

  return { beginLayerMove };
}
