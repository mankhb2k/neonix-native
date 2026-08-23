/** Atomic audio capabilities certified across protocol, runtime, preview, and export. */
export const V2_AUDIO_CAPABILITY_LEDGER = [
  { id: "audio.asset", fixtureId: "audio.asset", status: "certified", description: "Audio asset metadata and explicit source identity." },
  { id: "audio.timing", fixtureId: "audio.timing", status: "certified", description: "Composition start and duration for an audio clip." },
  { id: "audio.trim", fixtureId: "audio.trim", status: "certified", description: "Source-media trim range before playback-rate conversion." },
  { id: "audio.loop", fixtureId: "audio.loop", status: "certified", description: "Repeat a trimmed source span until clip duration ends." },
  { id: "audio.gain", fixtureId: "audio.gain", status: "certified", description: "Independent track and clip gain in decibels." },
  { id: "audio.pan", fixtureId: "audio.pan", status: "certified", description: "Track pan in the normalized range -1 through 1." },
  { id: "audio.fade", fixtureId: "audio.fade", status: "certified", description: "Linear and equal-power clip fade envelopes." },
  { id: "audio.track.mute", fixtureId: "audio.track.mute", status: "certified", description: "Mute a complete audio track without removing its clips." },
  { id: "audio.track.overlap", fixtureId: "audio.track.overlap", status: "certified", description: "Overlapping clips remain independent mix inputs." },
  { id: "audio.video-source", fixtureId: "audio.video-source", status: "certified", description: "Explicitly route a video asset's audio stream to a track." },
] as const;

export type V2AudioCapability =
  (typeof V2_AUDIO_CAPABILITY_LEDGER)[number]["id"];
export type V2AudioCapabilityStatus =
  (typeof V2_AUDIO_CAPABILITY_LEDGER)[number]["status"];

export function isV2AudioCapabilityCertified(value: string): value is V2AudioCapability {
  return V2_AUDIO_CAPABILITY_LEDGER.some(
    (entry) => entry.id === value && entry.status === "certified",
  );
}

/** Backward-compatible name for compiler callers; certified includes runtime readiness. */
export function isV2AudioCapabilityRuntimeReady(value: string): value is V2AudioCapability {
  return isV2AudioCapabilityCertified(value);
}
