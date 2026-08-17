import {
  AUDIO_ANALYSIS_FORMAT,
  AUDIO_ANALYSIS_FORMAT_VERSION,
  AudioAnalysisV1Schema,
  type AudioAnalysisV1,
} from "./schema";
import { decodeAudioFromUrl } from "./decode";
import { computeLoudness } from "./features/loudness";
import { computeBassEnergy } from "./features/bass-energy";
import { detectBeats } from "./features/beats";
import { detectSections } from "./features/sections";

export const AUDIO_ANALYSIS_ANALYZER_VERSION = "0.1.0";

export type AnalyzeAudioInput = {
  /** Public URL or object URL of the audio asset (browser decode path). */
  audioUrl: string;
  projectId: string;
  audioAssetId: string;
  audioHash?: string;
  audioContext?: AudioContext;
};

export type AnalyzePcmInput = {
  /** Mono (or interleaved-mixed) PCM samples in [-1, 1]. */
  samples: Float32Array;
  sampleRate: number;
  channels?: number;
  projectId: string;
  audioAssetId: string;
  audioHash?: string;
};

export type AnalyzeAudioOptions = {
  hopSeconds?: number;
  beatThreshold?: number;
  minBeatGap?: number;
  bassCutoffHz?: number;
  sectionWindowSeconds?: number;
};

/**
 * Analyze already-decoded mono PCM. This is the pure, testable core — it does
 * no I/O and depends only on the sample data.
 */
export function analyzePcm(
  input: AnalyzePcmInput,
  options: AnalyzeAudioOptions = {},
): AudioAnalysisV1 {
  const { samples, sampleRate } = input;
  const hopSeconds = options.hopSeconds ?? 0.05;
  const channels = input.channels ?? 1;
  const duration = samples.length / sampleRate;

  const loudness = computeLoudness(samples, sampleRate, { hopSeconds });
  const bassEnergy = computeBassEnergy(samples, sampleRate, {
    hopSeconds,
    cutoffHz: options.bassCutoffHz,
  });
  const beats = detectBeats(bassEnergy, {
    threshold: options.beatThreshold,
    minBeatGap: options.minBeatGap,
  });
  const sections = detectSections(
    { duration, loudness, bassEnergy, beats },
    { windowSeconds: options.sectionWindowSeconds },
  );

  return AudioAnalysisV1Schema.parse({
    format: AUDIO_ANALYSIS_FORMAT,
    formatVersion: AUDIO_ANALYSIS_FORMAT_VERSION,
    projectId: input.projectId,
    audioAssetId: input.audioAssetId,
    audioHash: input.audioHash,
    duration,
    sampleRate,
    channels,
    hopSeconds,
    beats,
    bassEnergy,
    loudness,
    sections,
    createdAt: new Date().toISOString(),
    analyzerVersion: AUDIO_ANALYSIS_ANALYZER_VERSION,
  });
}

/**
 * Fetch + decode an audio URL, then analyze it (browser).
 * For server/desktop, decode with ffmpeg and call `analyzePcm` directly.
 */
export async function analyzeAudio(
  input: AnalyzeAudioInput,
  options: AnalyzeAudioOptions = {},
): Promise<AudioAnalysisV1> {
  const pcm = await decodeAudioFromUrl(input.audioUrl, input.audioContext);
  return analyzePcm(
    {
      samples: pcm.samples,
      sampleRate: pcm.sampleRate,
      channels: pcm.channels,
      projectId: input.projectId,
      audioAssetId: input.audioAssetId,
      audioHash: input.audioHash,
    },
    options,
  );
}
