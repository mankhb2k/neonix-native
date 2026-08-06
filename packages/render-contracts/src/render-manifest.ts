import { z } from "zod";

/**
 * Minimal RenderManifest stub — expanded in later PRs (Audio/Asset/Lambda).
 * Matches architecture §6.1 shape; fields beyond composition are optional for now.
 */
export const RenderManifestSchema = z.object({
  format: z.literal("moticlip-render-manifest"),
  formatVersion: z.literal(1),
  projectId: z.string(),
  projectRevision: z.number().int().nonnegative(),
  versions: z.object({
    schema: z.number(),
    compiler: z.string(),
    runtime: z.string(),
    remotion: z.string(),
    capabilityManifest: z.string(),
  }),
  composition: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    fps: z.number().positive(),
    durationInFrames: z.number().int().positive(),
    background: z.string(),
  }),
  runtime: z
    .object({
      url: z.string(),
      sha256: z.string(),
    })
    .optional(),
  assets: z
    .array(
      z.object({
        id: z.string(),
        url: z.string(),
        sha256: z.string(),
        mimeType: z.string(),
      }),
    )
    .optional(),
  output: z
    .object({
      codec: z.enum(["h264", "h265", "vp9", "prores"]),
      pixelFormat: z.string(),
      privacy: z.literal("private"),
    })
    .optional(),
});

export type RenderManifest = z.infer<typeof RenderManifestSchema>;

export function parseRenderManifest(input: unknown): RenderManifest {
  return RenderManifestSchema.parse(input);
}
