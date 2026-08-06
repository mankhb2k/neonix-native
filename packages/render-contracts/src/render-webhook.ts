import { z } from "zod";

export const RenderWebhookPayloadSchema = z.object({
  jobId: z.string(),
  renderId: z.string().optional(),
  status: z.enum(["done", "failed", "cancelled"]),
  bucketName: z.string().optional(),
  outputKey: z.string().optional(),
  error: z.string().optional(),
  /** Remotion Lambda webhook signature fields — validated at API boundary. */
  customData: z.record(z.unknown()).optional(),
});

export type RenderWebhookPayload = z.infer<typeof RenderWebhookPayloadSchema>;
