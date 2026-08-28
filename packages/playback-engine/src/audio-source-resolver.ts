import type { RuntimeAudioSourceV2 } from "@motionvideo/motion-runtime";

/** The bytes that the audio decoder must fetch for a runtime source. */
export function resolveAudioSourceUri(source: RuntimeAudioSourceV2): string {
  return source.kind === "video" && source.audioUri ? source.audioUri : source.uri;
}

/** Whether this video has an explicit, import-time audio derivative. */
export function hasAudioDerivative(source: RuntimeAudioSourceV2): boolean {
  return source.kind !== "video" || Boolean(source.audioUri);
}

/** Stable cache identity including derivative revision when present. */
export function audioSourceCacheKey(
  source: RuntimeAudioSourceV2,
  outputSampleRate: number,
): string {
  return [
    source.assetId,
    resolveAudioSourceUri(source),
    source.audioIntegrity ?? source.integrity ?? "",
    outputSampleRate,
  ].join("|");
}
