export const APP_NAME = "MotionVideo";
export const DEFAULT_LOCALE = "vi-VN";

export type AspectRatio = "9:16" | "16:9" | "1:1";

export type RenderJobStatus =
  | "queued"
  | "planning"
  | "rendering"
  | "encoding"
  | "done"
  | "failed";
