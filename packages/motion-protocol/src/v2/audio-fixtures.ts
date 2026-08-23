import type { V2AudioClip, V2AudioDomain, V2AudioTrack } from "./audio";
import type { V2AudioAsset, V2VideoAsset } from "./assets";
import type { V2AudioCapability } from "./audio-capabilities";
import type { MotionProtocolV2 } from "./types";

const MUSIC_ASSET: V2AudioAsset = {
  id: "music-mbb-island-tropical",
  kind: "audio",
  uri: "/api/docs/audio",
  mimeType: "audio/mpeg",
  duration: 124.551837,
  sampleRate: 44100,
  channels: 2,
};

const VIDEO_AUDIO_ASSET: V2VideoAsset = {
  id: "example-video-audio-source",
  kind: "video",
  uri: "/docs/example-video.mp4",
  mimeType: "video/mp4",
  width: 1920,
  height: 1080,
  duration: 60.5,
  fps: 30,
};

function clip(id: string, overrides: Partial<V2AudioClip> = {}): V2AudioClip {
  return {
    id,
    assetId: MUSIC_ASSET.id,
    timing: { start: 0, duration: 4 },
    trim: { start: 0 },
    playbackRate: 1,
    loop: false,
    gainDb: 0,
    ...overrides,
  };
}

function track(
  id: string,
  clips: V2AudioClip[],
  overrides: Partial<V2AudioTrack> = {},
): V2AudioTrack {
  return { id, gainDb: 0, pan: 0, muted: false, clips, ...overrides };
}

function audioProject(
  id: string,
  tracks: V2AudioTrack[],
  assets: MotionProtocolV2["assets"] = [MUSIC_ASSET],
): MotionProtocolV2 {
  const audio: V2AudioDomain = { sampleRate: 48000, tracks };
  return {
    format: "motion-protocol",
    formatVersion: 2,
    id,
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#101820",
      colorSpace: "srgb",
      view: {
        projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
        transform: {
          translate: { x: 0, y: 0, z: 0 },
          rotate: { x: 0, y: 0, z: 0 },
        },
      },
    },
    assets,
    layers: [],
    audio,
  };
}

export type V2AudioFixture = {
  id: string;
  label: string;
  hint: string;
  capability: V2AudioCapability;
  project: MotionProtocolV2;
  previewTime?: number;
};

export const V2_AUDIO_FIXTURES: V2AudioFixture[] = [
  { id: "audio.asset", label: "Audio / asset", hint: "Local MP3 metadata is referenced by an immutable V2 audio asset.", capability: "audio.asset", project: audioProject("preview-audio-asset-v2", []) },
  { id: "audio.timing", label: "Audio / timing", hint: "The clip starts at 0.5 seconds and occupies four seconds of composition time.", capability: "audio.timing", project: audioProject("preview-audio-timing-v2", [track("timing-track", [clip("timing-clip", { timing: { start: 0.5, duration: 4 } })])]), previewTime: 0.5 },
  { id: "audio.trim", label: "Audio / trim", hint: "The composition clip uses source seconds 8 through 14 from the MP3.", capability: "audio.trim", project: audioProject("preview-audio-trim-v2", [track("trim-track", [clip("trim-clip", { timing: { start: 1, duration: 5 }, trim: { start: 8, end: 14 } })])]), previewTime: 1 },
  { id: "audio.loop", label: "Audio / loop", hint: "A four-second source span repeats across a twelve-second timeline clip.", capability: "audio.loop", project: audioProject("preview-audio-loop-v2", [track("loop-track", [clip("loop-clip", { timing: { start: 0, duration: 12 }, trim: { start: 0, end: 4 }, loop: true })])]), previewTime: 6 },
  { id: "audio.gain", label: "Audio / gain", hint: "Independent -6 dB track and clip gains combine to a clearly audible -12 dB attenuation over ten seconds.", capability: "audio.gain", project: audioProject("preview-audio-gain-v2", [track("gain-track", [clip("gain-clip", { timing: { start: 0, duration: 10 }, gainDb: -6 })], { gainDb: -6 })]) },
  { id: "audio.pan", label: "Audio / pan", hint: "The ten-second clip is hard-panned fully right with the normalized input +1.", capability: "audio.pan", project: audioProject("preview-audio-pan-v2", [track("pan-track", [clip("pan-clip", { timing: { start: 0, duration: 10 } })], { pan: 1 })]) },
  { id: "audio.fade", label: "Audio / fade", hint: "A centered twenty-second excerpt uses four-second linear fade-in and equal-power fade-out ramps.", capability: "audio.fade", project: audioProject("preview-audio-fade-v2", [track("fade-track", [clip("fade-clip", { timing: { start: 0, duration: 20 }, trim: { start: 52, end: 72 }, fadeIn: { duration: 4, curve: "linear" }, fadeOut: { duration: 4, curve: "equal-power" } })])]), previewTime: 0 },
  { id: "audio.track.mute", label: "Audio / track mute", hint: "The track remains in the protocol but is muted without deleting its clip.", capability: "audio.track.mute", project: audioProject("preview-audio-track-mute-v2", [track("muted-track", [clip("muted-clip")], { muted: true })]) },
  { id: "audio.track.overlap", label: "Audio / overlapping clips", hint: "Two independent clips overlap on one track and will later become two mix inputs.", capability: "audio.track.overlap", project: audioProject("preview-audio-overlap-v2", [track("overlap-track", [clip("overlap-a", { timing: { start: 0, duration: 5 } }), clip("overlap-b", { timing: { start: 3, duration: 5 }, trim: { start: 12, end: 17 } })])]), previewTime: 4 },
  { id: "audio.video-source", label: "Audio / video source", hint: "The first ten seconds of a video's audio stream are referenced explicitly without creating a visual layer.", capability: "audio.video-source", project: audioProject("preview-audio-video-source-v2", [track("video-audio-track", [clip("video-audio-clip", { assetId: VIDEO_AUDIO_ASSET.id, timing: { start: 0, duration: 10 }, trim: { start: 0, end: 10 } })])], [VIDEO_AUDIO_ASSET]) },
];
