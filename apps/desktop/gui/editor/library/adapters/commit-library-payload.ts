/**
 * Commit library payload with optional PlacementTarget from the gesture.
 * Placement must be resolved once at pointer-up (not again here) so insert-lane
 * hysteresis / DOM geometry stay consistent with the allowDrop check.
 */

import { payloadToTimelineCommand } from "./payload-to-timeline-command";
import type { LibraryPayload } from "../model/library-payload";
import type { PlacementTarget, TimelineCommand } from "@motionvideo/editor-core";

export type LibraryCommitPoint = {
  mode: "click" | "drag";
  /** Set when mode is "drag" — same target used to allow the drop. */
  placement?: PlacementTarget;
};

export function commitLibraryPayload(
  payload: LibraryPayload,
  point: LibraryCommitPoint | undefined,
  onExecuteTimeline: (command: TimelineCommand, label: string) => void,
): void {
  if (point?.mode === "drag" && !point.placement) return;
  const { command, label } = payloadToTimelineCommand(
    payload,
    point?.mode === "drag" ? point.placement : undefined,
  );
  onExecuteTimeline(command, label);
}
