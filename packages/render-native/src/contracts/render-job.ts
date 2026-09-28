import { z } from "zod";

export const RenderJobStatusSchema = z.enum([
  "queued",
  "planning",
  "rendering",
  "encoding",
  "muxing",
  "publishing",
  "done",
  "failed",
  "cancelled",
]);

export type RenderJobStatus = z.infer<typeof RenderJobStatusSchema>;

export const RenderJobProgressSchema = z.object({
  jobId: z.string(),
  status: RenderJobStatusSchema,
  /** 0..1 overall progress */
  progress: z.number().min(0).max(1),
  stage: z.string().optional(),
  error: z.string().optional(),
  artifactPath: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type RenderJobProgress = z.infer<typeof RenderJobProgressSchema>;
