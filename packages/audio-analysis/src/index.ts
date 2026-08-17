export {
  AudioAnalysisV1Schema,
  parseAudioAnalysisV1,
  AUDIO_ANALYSIS_FORMAT,
  AUDIO_ANALYSIS_FORMAT_VERSION,
  SECTION_TYPES,
} from "./schema";
export type {
  AudioAnalysisV1,
  Beat,
  EnergyFrame,
  Section,
  SectionType,
} from "./schema";

export {
  analyzeAudio,
  analyzePcm,
  AUDIO_ANALYSIS_ANALYZER_VERSION,
} from "./analyze";
export type {
  AnalyzeAudioInput,
  AnalyzeAudioOptions,
  AnalyzePcmInput,
} from "./analyze";

export { decodeAudioFromUrl, audioBufferToMonoPcm, mixChannelsToMono } from "./decode";
export type { MonoPcm } from "./decode";

export { audioAnalysisToTimelineClips } from "./mapping/audio-to-clips";
export type {
  AudioMotionPreset,
  AudioMotionTargets,
  AudioToClipsInput,
  AudioToClipsOptions,
  TimelineKeyframeV1,
  TimelinePropertyClipV1,
} from "./mapping/audio-to-clips";

export {
  audioAnalysisObjectKey,
  projectAssetObjectKey,
  projectRootKey,
  waveformObjectKey,
  renderArtifactObjectKey,
  sanitizeKeySegment,
} from "./artifacts/object-keys";
export type {
  AudioAnalysisKeyInput,
  ProjectAssetKeyInput,
  ProjectAssetType,
  RenderArtifactKeyInput,
} from "./artifacts/object-keys";

export {
  loadAudioAnalysisArtifact,
} from "./artifacts/load-analysis";
export {
  saveAudioAnalysisArtifact,
  serializeAudioAnalysisV1,
} from "./artifacts/save-analysis";
export type { ArtifactStore } from "./artifacts/store";
