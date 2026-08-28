export type PlaybackEngineModeV3 = "legacy" | "next" | "shadow";
export type PlaybackFeatureFlagV3 = { readonly mode: PlaybackEngineModeV3; readonly shadowCompare: boolean };

export function resolvePlaybackFeatureFlagV3(value: unknown = "legacy"): PlaybackFeatureFlagV3 {
  const mode: PlaybackEngineModeV3 = value === "next" || value === "shadow" ? value : "legacy";
  return { mode, shadowCompare: mode === "shadow" };
}
