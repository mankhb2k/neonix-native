import { z } from "zod";

/**
 * RenderManifest — full architecture §6.1 contract for Lambda / remotion-site.
 *
 * §Phase 10 Task 10.1: added contentHash + determinism block for export parity.
 */

export const REMOTION_PIN = "4.0.506" as const;

export const RenderManifestSchema = z.object({
  format: z.literal("moticlip-render-manifest"),
  /** Manifest protocol version — NOT a MotionProject formatVersion. Bumped to 2 for Phase 10 (determinism + content hash). */
  manifestVersion: z.literal(2),
  projectId: z.string().min(1),
  projectRevision: z.number().int().nonnegative(),
  versions: z.object({
    schema: z.number(),
    compiler: z.string().min(1),
    runtime: z.string().min(1),
    remotion: z.literal(REMOTION_PIN),
    capabilityManifest: z.string().min(1),
  }),
  /**
   * SHA-256 of the canonical compiled runtime JSON.
   * Guarantees: same MotionRuntimeProject → same hash.
   * @since Phase 10
   */
  contentHash: z.string().length(64),
  /**
   * Determinism contract — epsilon values & schema version used during
   * compile. Export pipeline must match these to reproduce pixel-identical
   * output.
   * @since Phase 10
   */
  determinism: z.object({
    /** Determinism schema version (bumped when rules change). */
    version: z.literal(1),
    /** Frame epsilon constant used during evaluation. */
    frameEpsilon: z.number(),
    /** Geometry epsilon for matrix/length checks. */
    geometryEpsilon: z.number(),
    /** Length epsilon for spatial comparisons. */
    lengthEpsilon: z.number(),
    /** Hash algorithm used for contentHash. */
    hashAlgorithm: z.literal("sha256"),
    /** Whether canonical JSON key ordering was used. */
    canonicalJson: z.literal(true),
  }),
  composition: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    fps: z.number().positive(),
    durationInFrames: z.number().int().positive(),
    background: z.string().min(1),
  }),
  runtime: z.object({
    url: z.string().min(1),
    sha256: z.string().min(1),
  }),
  assets: z.array(
    z.object({
      id: z.string().min(1),
      url: z.string().min(1),
      sha256: z.string().min(1),
      mimeType: z.string().min(1),
    }),
  ),
  /**
   * Audio manifest — summary of audio clips in the project.
   * @since Phase 10
   */
  audio: z
    .object({
      clipCount: z.number().int().nonnegative(),
      totalDurationSeconds: z.number().nonnegative(),
      /** Sample rate used for audio rendering (Hz). */
      sampleRate: z.number().int().positive().default(48000),
      /** Audio codec for export. */
      codec: z.enum(["aac", "opus", "mp3", "pcm"]).default("aac"),
    })
    .optional(),
  output: z.object({
    codec: z.enum(["h264", "h265", "vp9", "prores"]),
    pixelFormat: z.string().min(1),
    privacy: z.literal("private"),
  }),
});

export type RenderManifest = z.infer<typeof RenderManifestSchema>;

export function parseRenderManifest(input: unknown): RenderManifest {
  return RenderManifestSchema.parse(input);
}
