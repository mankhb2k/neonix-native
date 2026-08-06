import { z } from "zod";

export const CreateRenderJobRequestSchema = z.object({
  projectId: z.string(),
  projectRevision: z.number().int().nonnegative().optional(),
  idempotencyKey: z.string().optional(),
  /** Opaque client payload; server builds RenderManifest. */
  preset: z.string().optional(),
});

export type CreateRenderJobRequest = z.infer<
  typeof CreateRenderJobRequestSchema
>;

export const CreateRenderJobResponseSchema = z.object({
  jobId: z.string(),
  status: z.string(),
});

export type CreateRenderJobResponse = z.infer<
  typeof CreateRenderJobResponseSchema
>;
