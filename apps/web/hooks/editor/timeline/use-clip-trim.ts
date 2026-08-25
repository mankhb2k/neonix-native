/**
 * Clip edge-trim gesture — controlled preview + command callbacks.
 */

import { useCallback } from "react";
import {
  MIN_CLIP_SLICE_SEC,
  selectionClips,
  type EditorSelection,
  type TimelineClip,
  type TimelineEdit,
  resolveClipTrimUpdate,
  type ClipTrimPreview,
} from "@motionvideo/editor-core/timeline";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { BeginGesture } from "../pointer/use-pointer-session-host";

export type { ClipTrimPreview };

export type UseClipTrimArgs = {
  pixelsPerSecond: number;
  disabled?: boolean;
  beginGesture: BeginGesture;
  onSelect: (selection: EditorSelection) => void;
  onCommand: (command: TimelineEdit, label: string) => void;
  onTrimPreview: (preview: ClipTrimPreview | null) => void;
};

export function useClipTrim({
  pixelsPerSecond,
  disabled,
  beginGesture,
  onSelect,
  onCommand,
  onTrimPreview,
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

      type TrimState = { startTime: number; duration: number };
      beginGesture<TrimState, void>(
        {
          name: `trim-${clip.id}-${edge}`,
          onStart: () => ({ startTime: originStart, duration: originDur }),
          onUpdate: (pos) => {
            const dx = (pos.x - originX) / pps;
            const next = resolveClipTrimUpdate({
              edge,
              originStart,
              originDuration: originDur,
              deltaSec: dx,
              minDuration: MIN_CLIP_SLICE_SEC,
            });
            onTrimPreview({
              kind: "trim",
              clipId: clip.id,
              startTime: next.startTime,
              duration: next.duration,
            });
            return next;
          },
          onCommit: (state) => {
            onTrimPreview(null);
            onCommand(
              {
                type: "clip/trim",
                clipId: clip.id,
                startTime: state.startTime,
                duration: state.duration,
              },
              "Trim clip",
            );
          },
          onCancel: () => onTrimPreview(null),
        },
        { x: event.clientX, y: event.clientY },
        event.currentTarget,
        event.pointerId,
      );
    },
    [beginGesture, disabled, onCommand, onTrimPreview, onSelect, pps],
  );

  return { beginTrim };
}
