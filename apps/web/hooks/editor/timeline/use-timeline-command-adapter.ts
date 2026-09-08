"use client";

import { useCallback } from "react";
import { useEditorActions } from "@/hooks/editor/use-editor-actions";
import { useEditorLocks } from "@/hooks/editor/use-editor-store";
import { timelineEditToDocumentCommand } from "@motionvideo/editor-core/timeline";
import type {
  LayerTimelineProjection,
  TimelineEdit,
} from "@motionvideo/editor-core/timeline";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

type UseTimelineCommandAdapterArgs = {
  document: MotionProtocolV2;
  projection: LayerTimelineProjection;
};

/** Converts timeline intents and sends the resulting command to editor history. */
export function useTimelineCommandAdapter({
  document,
  projection,
}: UseTimelineCommandAdapterArgs) {
  const { applyCommand } = useEditorActions();
  const lockedLayerIds = useEditorLocks();

  return useCallback(
    (command: TimelineEdit, label: string) => {
      void label;

      const documentCommand = timelineEditToDocumentCommand(
        document,
        projection,
        command,
        { lockedLayerIds },
      );
      if (documentCommand) applyCommand(documentCommand);
    },
    [applyCommand, document, lockedLayerIds, projection],
  );
}
