/**
 * Web adapter — thin wrapper around useClipTrim from editor-react.
 */

import {
  useClipTrim as useClipTrimShared,
  type ClipTrimPreview,
} from "@/hooks/editor/timeline/use-clip-trim";
import type { BeginGesture } from "@/hooks/editor/pointer/use-pointer-session-host";
import type {
  EditorSelection,
  TimelineEdit,
} from "@motionvideo/editor-core/timeline";

export type { ClipTrimPreview };

export type UseClipTrimArgs = {
  pixelsPerSecond: number;
  disabled?: boolean;
  beginGesture: BeginGesture;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (command: TimelineEdit, label: string) => void;
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
