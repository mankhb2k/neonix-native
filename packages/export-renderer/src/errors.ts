export class ExportRendererError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_PROJECT"
      | "UNSUPPORTED_COMMAND"
      | "NON_AFFINE_TRANSFORM"
      | "FFMPEG_FAILED"
      | "OUTPUT_FAILED",
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ExportRendererError";
  }
}
