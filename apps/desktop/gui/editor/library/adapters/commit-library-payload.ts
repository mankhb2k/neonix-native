/**
 * Commit library payload with PlacementTarget resolved once by the gesture.
 */

import { payloadToTimelineCommand } from "./payload-to-timeline-command";
import type { LibraryPayload } from "../model/library-payload";
import type { PlacementTarget, TimelineCommand } from "@motionvideo/editor-core";

export type LibraryCommitPoint =
  | { mode: "click" }
  | { mode: "drag"; placement: PlacementTarget };

export function commitLibraryPayload(
  payload: LibraryPayload,
  point: LibraryCommitPoint | undefined,
  onExecuteTimeline: (command: TimelineCommand, label: string) => void,
): void {
  const target = point?.mode === "drag" ? point.placement : undefined;
  const { command, label } = payloadToTimelineCommand(payload, target);
  onExecuteTimeline(command, label);
}
