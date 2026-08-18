/**
 * Layer-mode edge trim — controlled preview + property command.
 */

import { useCallback } from "react";
import {
  selectionNode,
  type DocumentPropertyCommand,
  type EditorSelection,
  type TimelineClip,
} from "@motionvideo/editor-core";
import {
  clampNodeLocalTiming,
  type ClipTrimPreview,
} from "@motionvideo/editor-interactions";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { BeginGesture } from "../pointer/use-pointer-session-host";
import type { LayerMoveSession } from "./use-layer-move";

const MIN_LAYER_DURATION_SEC = 0.05;

export type UseLayerTrimArgs = {
  pixelsPerSecond: number;
  disabled?: boolean;
  layerSession: LayerMoveSession | null;
  beginGesture: BeginGesture;
  onSelect: (selection: EditorSelection) => void;
  onCommandProperty?: (input: {
    command: DocumentPropertyCommand;
    label: string;
    coalesceKey?: string;
  }) => void;
  onTrimPreview: (preview: ClipTrimPreview | null) => void;
};

export function useLayerTrim({
  pixelsPerSecond,
  disabled,
  layerSession,
  beginGesture,
  onSelect,
  onCommandProperty,
  onTrimPreview,
}: UseLayerTrimArgs) {
  const pps = Math.max(pixelsPerSecond, 0.001);

  const beginLayerTrim = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      clip: TimelineClip,
      edge: "left" | "right",
    ) => {
      if (!layerSession || disabled || event.button !== 0) return;
      if (!onCommandProperty) return;
      event.stopPropagation();
      event.preventDefault();
      onSelect(selectionNode(clip.id));

      const { containerStart, containerDuration, sceneId } = layerSession;
      const mediaMax =
        layerSession.mediaMaxDurationByNodeId?.get(clip.id) ?? null;
      const originX = event.clientX;
      const originLocalStart = Math.max(0, clip.startTime - containerStart);
      const originDur = clip.duration;
      const originLocalEnd = originLocalStart + originDur;

      type TrimState = { startTime: number; duration: number };
      beginGesture<TrimState, void>(
        {
          name: `layer-trim-${clip.id}-${edge}`,
          onStart: () => ({
            startTime: clip.startTime,
            duration: clip.duration,
          }),
          onUpdate: (pos) => {
            const dx = (pos.x - originX) / pps;
            let localStart = originLocalStart;
            let duration = originDur;
            if (edge === "right") {
              duration = originDur + dx;
              if (mediaMax != null) {
                duration = Math.min(duration, mediaMax);
              }
              duration = Math.max(MIN_LAYER_DURATION_SEC, duration);
              duration = Math.min(
                duration,
                Math.max(
                  MIN_LAYER_DURATION_SEC,
                  containerDuration - localStart,
                ),
              );
            } else {
              let nextStart = originLocalStart + dx;
              if (mediaMax != null) {
                nextStart = Math.max(nextStart, originLocalEnd - mediaMax);
              }
              nextStart = Math.min(
                originLocalEnd - MIN_LAYER_DURATION_SEC,
                Math.max(0, nextStart),
              );
              localStart = nextStart;
              duration = originLocalEnd - nextStart;
            }
            const clamped = clampNodeLocalTiming(
              localStart,
              duration,
              containerDuration,
              MIN_LAYER_DURATION_SEC,
            );
            const global = {
              startTime: containerStart + clamped.start,
              duration: clamped.duration,
            };
            onTrimPreview({
              kind: "trim",
              clipId: clip.id,
              ...global,
            });
            return global;
          },
          onCommit: (state) => {
            onTrimPreview(null);
            const localStart = state.startTime - containerStart;
            let duration = state.duration;
            if (mediaMax != null) {
              duration = Math.min(duration, mediaMax);
            }
            const clamped = clampNodeLocalTiming(
              localStart,
              duration,
              containerDuration,
              MIN_LAYER_DURATION_SEC,
            );
            onCommandProperty({
              command: {
                type: "set-node-timing",
                targets: [{ rootLayerId: sceneId, layerId: clip.id }],
                timing: clamped,
              },
              label: "Trim layer",
              coalesceKey: `node-timing:${sceneId}:${clip.id}`,
            });
          },
          onCancel: () => onTrimPreview(null),
        },
        { x: event.clientX, y: event.clientY },
        event.currentTarget,
        event.pointerId,
      );
    },
    [
      beginGesture,
      disabled,
      layerSession,
      onCommandProperty,
      onTrimPreview,
      onSelect,
      pps,
    ],
  );

  return { beginLayerTrim };
}
