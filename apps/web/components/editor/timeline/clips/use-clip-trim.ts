/**
 * Web adapter — thin wrapper around useClipTrim from editor-react.
 */

import {
  useClipTrim as useClipTrimShared,
  type BeginGesture,
  type ClipTrimPreview,
} from "@motionvideo/editor-react";
import type {
  EditorSelection,
  TimelineCommand,
} from "@motionvideo/editor-core";

export type { ClipTrimPreview };

export type UseClipTrimArgs = {
  pixelsPerSecond: number;
  disabled?: boolean;
  beginGesture: BeginGesture;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (command: TimelineCommand, label: string) => void;
  onLocalPreview: (preview: ClipTrimPreview | null) => void;
};

export function useClipTrim({
  onExecute,
  onLocalPreview,
  ...rest
}: UseClipTrimArgs) {
  return useClipTrimShared({
    ...rest,
    onCommand: onExecute,
    onTrimPreview: onLocalPreview,
  });
}
