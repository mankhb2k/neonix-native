export type DriftActionV3 = "none" | "tolerate" | "soft-adjust" | "hard-seek";

export type DriftDecisionV3 = {
  readonly action: DriftActionV3;
  readonly driftUs: number;
};

export type DriftControllerV3 = {
  update(masterTimeUs: number, mediaTimeUs: number): DriftDecisionV3;
};

/** Pure policy for a follower media element; it never performs the seek. */
export function createDriftControllerV3(options: { toleranceUs?: number; softThresholdUs?: number; hardThresholdUs?: number } = {}): DriftControllerV3 {
  const toleranceUs = Math.max(0, options.toleranceUs ?? 50_000);
  const softThresholdUs = Math.max(toleranceUs, options.softThresholdUs ?? 100_000);
  const hardThresholdUs = Math.max(softThresholdUs, options.hardThresholdUs ?? 250_000);
  return {
    update(masterTimeUs, mediaTimeUs) {
      const driftUs = mediaTimeUs - masterTimeUs;
      const magnitude = Math.abs(driftUs);
      const action: DriftActionV3 = magnitude <= toleranceUs ? "none" : magnitude <= softThresholdUs ? "tolerate" : magnitude < hardThresholdUs ? "soft-adjust" : "hard-seek";
      return { action, driftUs };
    },
  };
}
