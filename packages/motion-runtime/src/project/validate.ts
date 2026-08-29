import { COMPOSITION_SAMPLE_RATE_V3 } from "../audio/audio-mixing";
import type {
  RuntimeAudioClipV3,
  RuntimeMediaAssetV3,
  RuntimeMediaAudioStreamV3,
  RuntimeMediaSourceRefV3,
  RuntimeMediaVideoStreamV3,
  RuntimeProjectV3,
  RuntimeValidationV3,
} from "./types";

type DiagnosticSink = (code: string, message: string, path?: string) => void;

const finite = (value: number): boolean => Number.isFinite(value);
const nonNegativeFinite = (value: number): boolean => finite(value) && value >= 0;
const positiveFinite = (value: number): boolean => finite(value) && value > 0;

export function validateRuntimeProjectV3(runtime: RuntimeProjectV3): RuntimeValidationV3 {
  const diagnostics: RuntimeValidationV3["diagnostics"] = [];
  const error: DiagnosticSink = (code, message, path) => {
    diagnostics.push({ severity: "error", code, message, ...(path ? { path } : {}) });
  };

  if (runtime.format !== "motion-runtime") error("FORMAT", "format must be motion-runtime");
  if (runtime.runtimeVersion !== 3) error("VERSION", "runtimeVersion must be 3");
  if (!runtime.projectId) error("PROJECT_ID", "projectId is required");
  if (runtime.audioTimeline.sampleRate !== COMPOSITION_SAMPLE_RATE_V3) {
    error("SAMPLE_RATE", `audio sampleRate must be ${COMPOSITION_SAMPLE_RATE_V3}`);
  }

  validateVisual(runtime, error);

  const assets = new Map<string, RuntimeMediaAssetV3>();
  const streams = new Set<string>();
  for (const [index, asset] of runtime.mediaCatalog.assets.entries()) {
    const path = `mediaCatalog.assets[${index}]`;
    if (!asset.mediaId) error("MEDIA_ID", "mediaId is required", path);
    if (assets.has(asset.mediaId)) error("DUPLICATE_MEDIA", asset.mediaId, path);
    assets.set(asset.mediaId, asset);
    validateMediaStreams(asset, path, streams, error);
  }

  const nodes = new Set(runtime.visual.nodes.map((node) => node.id));
  const instances = new Set<string>();
  for (const [index, instance] of runtime.videoTimeline.instances.entries()) {
    const path = `videoTimeline.instances[${index}]`;
    if (instances.has(instance.instanceId)) error("DUPLICATE_INSTANCE", instance.instanceId, path);
    instances.add(instance.instanceId);
    if (!nodes.has(instance.nodeId)) error("MISSING_NODE", instance.nodeId, path);
    const stream = resolveStream(assets, instance.source, "video", path, error);
    if (!positiveFinite(instance.playbackRate) || !nonNegativeFinite(instance.timelineStartUs) || !positiveFinite(instance.timelineDurationUs) || !nonNegativeFinite(instance.sourceStartUs)) {
      error("INVALID_VIDEO_TIMING", "video timing must be finite and non-negative", path);
    }
    if (instance.sourceEndUs !== undefined && instance.sourceEndUs <= instance.sourceStartUs) {
      error("INVALID_VIDEO_SOURCE_RANGE", "sourceEndUs must be greater than sourceStartUs", path);
    }
    const videoStream = stream && "durationUs" in stream ? stream : undefined;
    const sourceEndUs = instance.sourceEndUs ?? videoStream?.durationUs;
    if (videoStream && sourceEndUs !== undefined && instance.sourceStartUs + instance.timelineDurationUs * instance.playbackRate > sourceEndUs + 1) {
      error("VIDEO_SOURCE_OVERRUN", "video timeline exceeds its source range", path);
    }
  }

  const trackIds = new Set<string>();
  const clipIds = new Set<string>();
  for (const [trackIndex, track] of runtime.audioTimeline.tracks.entries()) {
    const trackPath = `audioTimeline.tracks[${trackIndex}]`;
    if (!track.trackId) error("TRACK_ID", "trackId is required", trackPath);
    if (trackIds.has(track.trackId)) error("DUPLICATE_TRACK", track.trackId, trackPath);
    trackIds.add(track.trackId);
    if (!nonNegativeFinite(track.gainLinear)) error("INVALID_TRACK_GAIN", "track gain must be finite and non-negative", trackPath);
    if (!finite(track.pan) || track.pan < -1 || track.pan > 1) error("INVALID_TRACK_PAN", "track pan must be within -1 and 1", trackPath);

    for (const [clipIndex, clip] of track.clips.entries()) {
      const clipPath = `${trackPath}.clips[${clipIndex}]`;
      if (!clip.clipId) error("CLIP_ID", "clipId is required", clipPath);
      if (clipIds.has(clip.clipId)) error("DUPLICATE_CLIP", clip.clipId, clipPath);
      clipIds.add(clip.clipId);
      if (clip.trackId !== track.trackId) error("TRACK_MISMATCH", "clip trackId does not match its containing track", clipPath);
      const stream = resolveStream(assets, clip.source, "audio", `${clipPath}.source`, error);
      validateAudioClip(clip, stream, clipPath, error);
    }
  }

  return { ok: diagnostics.length === 0, diagnostics };
}

/** Lightweight visual validation that does not require audio resources to be ready. */
export function validateRuntimeVisualProjectV3(runtime: RuntimeProjectV3): RuntimeValidationV3 {
  const diagnostics: RuntimeValidationV3["diagnostics"] = [];
  const error: DiagnosticSink = (code, message, path) => {
    diagnostics.push({ severity: "error", code, message, ...(path ? { path } : {}) });
  };
  validateVisual(runtime, error);
  return { ok: diagnostics.length === 0, diagnostics };
}

function validateVisual(runtime: RuntimeProjectV3, error: DiagnosticSink): void {
  const composition = runtime.visual.composition;
  if (!positiveFinite(composition.width) || !positiveFinite(composition.height) || !positiveFinite(composition.fps)) {
    error("INVALID_COMPOSITION", "composition dimensions and fps must be positive finite numbers", "visual.composition");
  }
  const ids = new Set<string>();
  for (const [index, node] of runtime.visual.nodes.entries()) {
    const path = `visual.nodes[${index}]`;
    if (!node.id) error("NODE_ID", "node id is required", path);
    if (ids.has(node.id)) error("DUPLICATE_NODE", node.id, path);
    ids.add(node.id);
    if (!nonNegativeFinite(node.timing.start) || !nonNegativeFinite(node.timing.duration)) {
      error("INVALID_NODE_TIMING", "node timing must be finite and non-negative", path);
    }
  }
}

function validateMediaStreams(asset: RuntimeMediaAssetV3, path: string, streamIds: Set<string>, error: DiagnosticSink): void {
  const register = (streamId: string, streamPath: string): void => {
    if (!streamId) error("STREAM_ID", "streamId is required", streamPath);
    if (streamIds.has(streamId)) error("DUPLICATE_STREAM", streamId, streamPath);
    streamIds.add(streamId);
  };
  for (const [index, stream] of asset.video?.entries() ?? []) {
    const streamPath = `${path}.video[${index}]`;
    register(stream.streamId, streamPath);
    validateVideoStream(stream, streamPath, error);
  }
  for (const [index, stream] of asset.audio?.entries() ?? []) {
    const streamPath = `${path}.audio[${index}]`;
    register(stream.streamId, streamPath);
    validateAudioStream(stream, streamPath, error);
  }
}

function validateVideoStream(stream: RuntimeMediaVideoStreamV3, path: string, error: DiagnosticSink): void {
  if (!nonNegativeFinite(stream.durationUs) || !positiveFinite(stream.width) || !positiveFinite(stream.height) || !positiveFinite(stream.frameRate)) {
    error("INVALID_VIDEO_STREAM", "video stream metadata must be finite and non-negative", path);
  }
  validateResource(stream.resource, path, error);
}

function validateAudioStream(stream: RuntimeMediaAudioStreamV3, path: string, error: DiagnosticSink): void {
  if (!nonNegativeFinite(stream.durationSamples) || !positiveFinite(stream.sampleRate) || !Number.isSafeInteger(stream.channels) || stream.channels < 1) {
    error("INVALID_AUDIO_STREAM", "audio stream metadata must be finite, positive and sample-domain valid", path);
  }
  validateResource(stream.resource, path, error);
}

function validateResource(resource: { resourceId: string; role: string; uri: string }, path: string, error: DiagnosticSink): void {
  if (!resource.resourceId || !resource.uri || !resource.role) {
    error("INVALID_RESOURCE", "media resources require resourceId, role and uri", `${path}.resource`);
  }
}

function resolveStream(assets: ReadonlyMap<string, RuntimeMediaAssetV3>, source: RuntimeMediaSourceRefV3, kind: "audio" | "video", path: string, error: DiagnosticSink): RuntimeMediaAudioStreamV3 | RuntimeMediaVideoStreamV3 | undefined {
  const asset = assets.get(source.mediaId);
  if (!asset) {
    error("MISSING_MEDIA", `media asset '${source.mediaId}' was not found`, path);
    return undefined;
  }
  const stream = kind === "audio"
    ? asset.audio?.find((candidate) => candidate.streamId === source.streamId)
    : asset.video?.find((candidate) => candidate.streamId === source.streamId);
  if (!stream) error("MISSING_STREAM", `${kind} stream '${source.streamId}' was not found`, path);
  return stream;
}

function validateAudioClip(clip: RuntimeAudioClipV3, stream: RuntimeMediaAudioStreamV3 | RuntimeMediaVideoStreamV3 | undefined, path: string, error: DiagnosticSink): void {
  if (!nonNegativeFinite(clip.timelineStartSample) || !positiveFinite(clip.timelineDurationSamples) || !nonNegativeFinite(clip.sourceStartSample) || !positiveFinite(clip.playbackRate) || !nonNegativeFinite(clip.gainLinear) || !finite(clip.pan) || clip.pan < -1 || clip.pan > 1) {
    error("INVALID_AUDIO_CLIP", "audio clip timing and mix fields are invalid", path);
  }
  if (clip.sourceEndSample !== undefined && clip.sourceEndSample <= clip.sourceStartSample) {
    error("INVALID_AUDIO_SOURCE_RANGE", "sourceEndSample must be greater than sourceStartSample", path);
  }
  validateFade(clip.fadeIn, clip.timelineDurationSamples, "fadeIn", path, error);
  validateFade(clip.fadeOut, clip.timelineDurationSamples, "fadeOut", path, error);
  if (!stream || !("sampleRate" in stream)) return;
  const sourceEnd = clip.sourceEndSample ?? stream.durationSamples;
  const requiredSourceSamples = clip.timelineDurationSamples * clip.playbackRate * stream.sampleRate / COMPOSITION_SAMPLE_RATE_V3;
  if (clip.sourceStartSample + requiredSourceSamples > sourceEnd + 1) {
    error("AUDIO_SOURCE_OVERRUN", "audio timeline exceeds its source range", path);
  }
}

function validateFade(fade: RuntimeAudioClipV3["fadeIn"], duration: number, name: "fadeIn" | "fadeOut", path: string, error: DiagnosticSink): void {
  if (!fade) return;
  if (!nonNegativeFinite(fade.durationSamples) || fade.durationSamples > duration) {
    error("INVALID_AUDIO_FADE", `${name} duration must be within the clip duration`, `${path}.${name}`);
  }
}
