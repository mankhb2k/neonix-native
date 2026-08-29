import type { PlaybackEngineState } from "./types";

export type PlaybackTransitionEventV3 =
  | "load"
  | "ready"
  | "play"
  | "pause"
  | "seek"
  | "error"
  | "dispose";

/** Pure state transition boundary used by future backends and orchestration. */
export function transitionPlaybackStateV3(
  state: PlaybackEngineState,
  event: PlaybackTransitionEventV3,
): PlaybackEngineState {
  if (event === "dispose") return "disposed";
  if (state === "disposed") return state;
  if (event === "error") return "error";
  if (event === "load") return "loading";
  if (event === "ready") return "ready";
  if (event === "play" && (state === "ready" || state === "paused")) return "playing";
  if (event === "pause" && state === "playing") return "paused";
  if (event === "seek" && state !== "idle") return "seeking";
  return state;
}
