/**
 * Clip edge-trim gesture controller.
 */

import { useCallback } from "react";
import {
  MIN_CLIP_SLICE_SEC,
  selectionClips,
  type EditorSelection,
  type TimelineClip,
  type TimelineCommand,
} from "@motionvideo/editor-core";
import type { BeginGesture } from "../interactions/use-pointer-session";
import type { PointerEvent as ReactPointerEvent } from "react";

export type ClipTrimPreview = {
  kind: "trim";
  clipId: string;
  startTime: number;
  duration: number;
};

export type UseClipTrimArgs = {
  pixelsPerSecond: number;
  disabled?: boolean;
  beginGesture: BeginGesture;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (command: TimelineCommand, label: string) => void;
  onLocalPreview: (preview: ClipTrimPreview | null) => void;
};

export function useClipTrim({
  pixelsPerSecond,
  disabled,
  beginGesture,
  onSelect,
  onExecute,
  onLocalPreview,
}: UseClipTrimArgs) {
  const pps = Math.max(pixelsPerSecond, 0.001);

  const beginTrim = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      clip: TimelineClip,
      edge: "left" | "right",
    ) => {
      if (disabled || event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      onSelect(selectionClips([clip.id]));

      const originX = event.clientX;
      const originStart = clip.startTime;
      const originDur = clip.duration;
      const originEnd = originStart + originDur;

      type TrimState = { startTime: number; duration: number };
      beginGesture<TrimState, void>(
        {
          name: `trim-${clip.id}-${edge}`,
          onStart: () => ({ startTime: originStart, duration: originDur }),
          onUpdate: (pos) => {
            const dx = (pos.x - originX) / pps;
            let startTime = originStart;
            let duration = originDur;
            if (edge === "right") {
              duration = Math.max(MIN_CLIP_SLICE_SEC, originDur + dx);
            } else {
              const nextStart = Math.min(
                originEnd - MIN_CLIP_SLICE_SEC,
                Math.max(0, originStart + dx),
              );
              startTime = nextStart;
              duration = originEnd - nextStart;
            }
            onLocalPreview({
              kind: "trim",
              clipId: clip.id,
              startTime,
              duration,
            });
            return { startTime, duration };
          },
          onCommit: (state) => {
            onLocalPreview(null);
            onExecute(
              {
                type: "clip/trim",
                clipId: clip.id,
                startTime: state.startTime,
                duration: state.duration,
              },
              "Trim clip",
            );
          },
          onCancel: () => onLocalPreview(null),
        },
        { x: event.clientX, y: event.clientY },
        event.currentTarget,
        event.pointerId,
      );
    },
    [beginGesture, disabled, onExecute, onLocalPreview, onSelect, pps],
  );

  return { beginTrim };
}
