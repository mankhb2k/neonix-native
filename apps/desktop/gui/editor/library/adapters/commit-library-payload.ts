/**
 * Commit library payload with optional PlacementTarget from drop geometry.
 */

import { resolveLibraryPlacement } from "../../timeline/drop-host";
import { payloadToTimelineCommand } from "./payload-to-timeline-command";
import type { LibraryPayload } from "../model/library-payload";
import type { PlacementTarget, TimelineCommand } from "@motionvideo/editor-core";

export type LibraryCommitPoint = {
  clientX: number;
  clientY: number;
  mode: "click" | "drag";
};

export function commitLibraryPayload(
  payload: LibraryPayload,
  point: LibraryCommitPoint | undefined,
  onExecuteTimeline: (command: TimelineCommand, label: string) => void,
): void {
  let target: PlacementTarget | undefined;
  if (point?.mode === "drag") {
    target = resolveLibraryPlacement(point.clientX, point.clientY, payload);
    if (!target) return;
  }
  const { command, label } = payloadToTimelineCommand(payload, target);
  onExecuteTimeline(command, label);
}
