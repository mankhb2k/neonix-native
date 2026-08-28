export type VideoPreloadPolicyInput = {
  active: boolean;
  lookahead: boolean;
  playing: boolean;
  hidden?: boolean;
  memoryPressure?: boolean;
};

export type VideoPreloadDecision = {
  preload: "auto" | "metadata";
  shouldPause: boolean;
};

/** Pure preload policy shared by DOM and future worker-backed video owners. */
export function decideVideoPreload(
  input: VideoPreloadPolicyInput,
): VideoPreloadDecision {
  const constrained = input.hidden === true || input.memoryPressure === true;
  const warm = input.active || input.lookahead;
  return {
    preload: !constrained && warm ? "auto" : "metadata",
    shouldPause: input.hidden === true || (!input.active && !input.lookahead) || !input.playing,
  };
}
