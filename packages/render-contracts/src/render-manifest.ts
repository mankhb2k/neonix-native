import { z } from "zod";

/**
 * RenderManifest — full architecture §6.1 contract for Lambda / remotion-site.
 */

export const REMOTION_PIN = "4.0.506" as const;

export const RenderManifestSchema = z.object({
  format: z.literal("moticlip-render-manifest"),
  formatVersion: z.literal(1),
  projectId: z.string().min(1),
  projectRevision: z.number().int().nonnegative(),
  versions: z.object({
    schema: z.number(),
    compiler: z.string().min(1),
    runtime: z.string().min(1),
    remotion: z.literal(REMOTION_PIN),
    capabilityManifest: z.string().min(1),
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
