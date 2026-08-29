export type VideoPreloadModeV3 = "active" | "lookahead" | "idle";
export type VideoPreloadDecisionV3 = { instanceId: string; mode: VideoPreloadModeV3; preload: "auto" | "metadata" | "none" };
export function decideVideoPreloadV3(activeInstanceIds: readonly string[], lookaheadInstanceIds: readonly string[], knownInstanceIds: readonly string[]): VideoPreloadDecisionV3[] {
  const active = new Set(activeInstanceIds), lookahead = new Set(lookaheadInstanceIds);
  return knownInstanceIds.map(instanceId => active.has(instanceId) ? { instanceId, mode: "active", preload: "auto" } : lookahead.has(instanceId) ? { instanceId, mode: "lookahead", preload: "metadata" } : { instanceId, mode: "idle", preload: "none" });
}
