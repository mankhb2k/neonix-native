import type { PlaybackReadinessV3 } from "./types";

export type ReadinessCoordinatorV3 = { set(status: PlaybackReadinessV3): void; status(): PlaybackReadinessV3; canPlay(): boolean };
export function createReadinessCoordinator(initial: PlaybackReadinessV3 = "unknown"): ReadinessCoordinatorV3 {
  let current = initial;
  return { set(status) { current = status; }, status: () => current, canPlay: () => current === "ready" };
}
