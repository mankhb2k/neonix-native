/**
 * Command family: cấu hình lane (rename-lane, update-lane-flags, reorder-lane).
 */
import { applyLaneFlagPatch } from "../../operations/lane-flags";
import { reorderLaneInFamily } from "../timeline-clips";
import type { CommandResult, TimelineCommand } from "./command-types";
import type { CommandRunnerState } from "./runner-state";

export function renameLane(
  state: CommandRunnerState,
  command: Extract<TimelineCommand, { type: "rename-lane" }>,
): undefined {
  state.lanes = state.lanes.map((l) =>
    l.id === command.laneId ? { ...l, name: command.name } : l,
  );
  state.events.push({ type: "lane-updated", laneId: command.laneId });
  return undefined;
}

export function updateLaneFlags(
  state: CommandRunnerState,
  command: Extract<TimelineCommand, { type: "update-lane-flags" }>,
): undefined {
  state.lanes = applyLaneFlagPatch(state.lanes, command.laneId, command.patch);
  state.events.push({ type: "lane-updated", laneId: command.laneId });
  return undefined;
}

export function reorderLane(
  state: CommandRunnerState,
  command: Extract<TimelineCommand, { type: "reorder-lane" }>,
): CommandResult | undefined {
  const reordered = reorderLaneInFamily(
    state.lanes,
    command.laneId,
    command.newOrder,
  );
  if (reordered === "blocked") {
    return {
      status: "rejected",
      reason: "missing_lane",
      message: "Lane không thể sắp xếp lại.",
    };
  }
  state.lanes = reordered;
  state.events.push({ type: "lane-updated", laneId: command.laneId });
  return undefined;
}
