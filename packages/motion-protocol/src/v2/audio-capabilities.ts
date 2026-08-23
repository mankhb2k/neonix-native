/**
 * Audio capability catalog. Phase 3 promotes the audio contract through the
 * compiler and Runtime Audio IR; preview scheduling and export parity remain
 * later gates.
 */
export const V2_AUDIO_CAPABILITY_LEDGER = [
  { id: "audio.asset", fixtureId: "audio.asset", status: "runtime-ready", description: "Audio asset metadata and explicit source identity." },
  { id: "audio.timing", fixtureId: "audio.timing", status: "runtime-ready", description: "Composition start and duration for an audio clip." },
  { id: "audio.trim", fixtureId: "audio.trim", status: "runtime-ready", description: "Source-media trim range before playback-rate conversion." },
  { id: "audio.loop", fixtureId: "audio.loop", status: "runtime-ready", description: "Repeat a trimmed source span until clip duration ends." },
  { id: "audio.gain", fixtureId: "audio.gain", status: "runtime-ready", description: "Independent track and clip gain in decibels." },
  { id: "audio.pan", fixtureId: "audio.pan", status: "runtime-ready", description: "Track pan in the normalized range -1 through 1." },
  { id: "audio.fade", fixtureId: "audio.fade", status: "runtime-ready", description: "Linear and equal-power clip fade envelopes." },
  { id: "audio.track.mute", fixtureId: "audio.track.mute", status: "runtime-ready", description: "Mute a complete audio track without removing its clips." },
  { id: "audio.track.overlap", fixtureId: "audio.track.overlap", status: "runtime-ready", description: "Overlapping clips remain independent mix inputs." },
  { id: "audio.video-source", fixtureId: "audio.video-source", status: "runtime-ready", description: "Explicitly route a video asset's audio stream to a track." },
] as const;

export type V2AudioCapability =
  (typeof V2_AUDIO_CAPABILITY_LEDGER)[number]["id"];
export type V2AudioCapabilityStatus =
  (typeof V2_AUDIO_CAPABILITY_LEDGER)[number]["status"];

export function isV2AudioCapabilityRuntimeReady(value: string): value is V2AudioCapability {
  return V2_AUDIO_CAPABILITY_LEDGER.some(
    (entry) => entry.id === value && entry.status === "runtime-ready",
  );
}
