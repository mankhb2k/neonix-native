/**
 * Desktop adapter — layer trim via controlled editor-react hook.
 */

import {
  useLayerTrim as useLayerTrimShared,
  type BeginGesture,
  type ClipTrimPreview,
  type LayerMoveSession,
} from "@motionvideo/editor-react";
import type {
  DocumentPropertyCommand,
  EditorSelection,
} from "@motionvideo/editor-core";

type Args = {
  pixelsPerSecond: number;
  disabled?: boolean;
  layerSession: LayerMoveSession | null;
  beginGesture: BeginGesture;
  onSelect: (selection: EditorSelection) => void;
  onExecuteProperty?: (input: {
    command: DocumentPropertyCommand;
    label: string;
    coalesceKey?: string;
  }) => void;
  onLocalPreview: (preview: ClipTrimPreview | null) => void;
};

export function useLayerTrim({
  onExecuteProperty,
  onLocalPreview,
  ...rest
}: Args) {
  return useLayerTrimShared({
    ...rest,
    onCommandProperty: onExecuteProperty,
    onTrimPreview: onLocalPreview,
  });
}
