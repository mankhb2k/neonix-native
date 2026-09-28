const PERMANENT_ERROR_CODES = new Set([
  "INVALID_RUNTIME_MANIFEST",
  "RUNTIME_CHECKSUM_MISMATCH",
  "CHUNK_MANIFEST_IMMUTABLE",
  "R2_SOURCE_NOT_FOUND",
  "AUDIO_TOPOLOGY_MISMATCH",
  "FINAL_VERIFY_FAILED",
  "CROSS_WORKSPACE_ACCESS",
  "INVALID_HMAC",
  "REPLAYED_REQUEST",
  "POISON_MESSAGE",
]);

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function errorCode(message: string): string {
  return message.split(":", 1)[0]?.trim() ?? message;
}

export function isPermanentRenderError(message: string): boolean {
  return PERMANENT_ERROR_CODES.has(errorCode(message));
}

export function isRetryableRenderError(message: string): boolean {
  return !isPermanentRenderError(message);
}

export function retryBudgetFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}
