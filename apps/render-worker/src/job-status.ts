export const RENDER_JOB_STATUSES = [
  "queued",
  "rendering",
  "done",
  "failed",
  "cancelled",
] as const;

export type RenderJobStatus = (typeof RENDER_JOB_STATUSES)[number];
