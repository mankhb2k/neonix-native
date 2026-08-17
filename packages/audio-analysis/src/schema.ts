import { z } from "zod";

/**
 * AudioAnalysisV1 is an app-level artifact, NOT part of MotionProjectV1.
 *
 * It is an intermediate, recomputable sidecar that lives on R2 under the
 * project namespace:
 *
 *   workspaces/{workspaceId}/projects/{projectId}/analysis/audio/{audioAssetId}.audio-analysis.v1.json
 *
 * The protocol itself only ever consumes baked `timeline.clips`, so these
 * fields (beats, bassEnergy, loudness, sections) never enter MotionProjectV1.
 */

export const AUDIO_ANALYSIS_FORMAT = "moticlip-audio-analysis" as const;
export const AUDIO_ANALYSIS_FORMAT_VERSION = 1 as const;

export const SECTION_TYPES = [
  "intro",
  "build",
  "drop",
  "main",
  "break",
  "outro",
] as const;

export const BeatSchema = z.object({
  t: z.number().nonnegative(),
  strength: z.number().min(0).max(1),
});

export const EnergyFrameSchema = z.object({
  t: z.number().nonnegative(),
  value: z.number().min(0).max(1),
});

export const SectionTypeSchema = z.enum(SECTION_TYPES);

export const SectionSchema = z.object({
  type: SectionTypeSchema,
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  confidence: z.number().min(0).max(1).optional(),
});

export const AudioAnalysisV1Schema = z.object({
  format: z.literal(AUDIO_ANALYSIS_FORMAT),
  formatVersion: z.literal(AUDIO_ANALYSIS_FORMAT_VERSION),

  projectId: z.string().min(1),
  audioAssetId: z.string().min(1),
  audioHash: z.string().optional(),

  duration: z.number().nonnegative(),
  sampleRate: z.number().positive(),
  channels: z.number().int().positive(),
  hopSeconds: z.number().positive(),

  beats: z.array(BeatSchema),
  bassEnergy: z.array(EnergyFrameSchema),
  loudness: z.array(EnergyFrameSchema),
  sections: z.array(SectionSchema),

  createdAt: z.string(),
  analyzerVersion: z.string(),
});

export type Beat = z.infer<typeof BeatSchema>;
export type EnergyFrame = z.infer<typeof EnergyFrameSchema>;
export type SectionType = z.infer<typeof SectionTypeSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type AudioAnalysisV1 = z.infer<typeof AudioAnalysisV1Schema>;

export function parseAudioAnalysisV1(input: unknown): AudioAnalysisV1 {
  return AudioAnalysisV1Schema.parse(input);
}
