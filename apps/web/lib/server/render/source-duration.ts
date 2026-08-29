import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

export type SourceDurationIssue = {
  code: "video_source_duration_mismatch" | "video_source_duration_missing";
  layerId: string;
  assetId: string;
  message: string;
};

/**
 * Export-side duration gate. The upload contract supplies the source duration;
 * a real media probe can replace that metadata later, but export must never
 * silently render beyond a known source range.
 */
export function validateProjectVideoDurations(
  project: MotionProtocolV2,
): SourceDurationIssue[] {
  const issues: SourceDurationIssue[] = [];
  for (const layer of project.layers) {
    if (layer.type !== "video") continue;
    const source = project.assets.find((asset) => asset.id === layer.payload.assetId);
    if (!source || source.kind !== "video" || source.duration === undefined) {
      issues.push({
        code: "video_source_duration_missing",
        layerId: layer.id,
        assetId: layer.payload.assetId,
        message: `Video layer ${layer.id} has no trusted source duration`,
      });
      continue;
    }
    const trimStart = layer.payload.trimStart ?? 0;
    const trimEnd = layer.payload.trimEnd ?? source.duration;
    const available = Math.max(0, trimEnd - trimStart);
    if (layer.timing.duration > available + 1e-6) {
      issues.push({
        code: "video_source_duration_mismatch",
        layerId: layer.id,
        assetId: source.id,
        message: `Video layer ${layer.id} requests ${layer.timing.duration}s but only ${available}s are available`,
      });
    }
  }
  return issues;
}
