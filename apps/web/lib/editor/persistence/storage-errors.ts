/** Lỗi ghi persistence — tách để test không cần DOM localStorage. */

export type SaveProjectErrorCode = "quota" | "write";

export class SaveProjectError extends Error {
  readonly code: SaveProjectErrorCode;

  constructor(code: SaveProjectErrorCode, message: string) {
    super(message);
    this.name = "SaveProjectError";
    this.code = code;
  }
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: string; code?: number };
  // DOMException name hoặc legacy code 22 / Firefox 1014.
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    err.code === 22 ||
    err.code === 1014
  );
}
