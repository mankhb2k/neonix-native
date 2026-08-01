export const DesktopIpcErrorCode = {
  VALIDATION: "VALIDATION",
  UNAUTHORIZED_SENDER: "UNAUTHORIZED_SENDER",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  INTERNAL: "INTERNAL",
  CORRUPT_FILE: "CORRUPT_FILE",
  UNSUPPORTED_VERSION: "UNSUPPORTED_VERSION",
  SAVE_FAILED: "SAVE_FAILED",
  CANCELLED: "CANCELLED",
  MISSING_ASSET: "MISSING_ASSET",
  PATH_DENIED: "PATH_DENIED",
  EXPORT_FAILED: "EXPORT_FAILED",
  OUTPUT_DENIED: "OUTPUT_DENIED",
} as const;

export type DesktopIpcErrorCode =
  (typeof DesktopIpcErrorCode)[keyof typeof DesktopIpcErrorCode];

export type DesktopIpcErrorPayload = {
  __desktopIpcError: true;
  code: DesktopIpcErrorCode;
  message: string;
  details?: unknown;
};

export class DesktopIpcError extends Error {
  readonly code: DesktopIpcErrorCode;
  readonly details?: unknown;

  constructor(code: DesktopIpcErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "DesktopIpcError";
    this.code = code;
    this.details = details;
  }
}

export function serializeDesktopIpcError(
  error: DesktopIpcError,
): DesktopIpcErrorPayload {
  return {
    __desktopIpcError: true,
    code: error.code,
    message: error.message,
    details: error.details,
  };
}

export function isDesktopIpcErrorPayload(
  value: unknown,
): value is DesktopIpcErrorPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as DesktopIpcErrorPayload).__desktopIpcError === true &&
    typeof (value as DesktopIpcErrorPayload).code === "string" &&
    typeof (value as DesktopIpcErrorPayload).message === "string"
  );
}

export function desktopIpcErrorFromUnknown(error: unknown): DesktopIpcError {
  if (error instanceof DesktopIpcError) return error;
  if (isDesktopIpcErrorPayload(error)) {
    return new DesktopIpcError(error.code, error.message, error.details);
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    const maybe = error as {
      message: string;
      code?: unknown;
      details?: unknown;
    };
    if (
      typeof maybe.code === "string" &&
      (Object.values(DesktopIpcErrorCode) as string[]).includes(maybe.code)
    ) {
      return new DesktopIpcError(
        maybe.code as DesktopIpcErrorCode,
        maybe.message,
        maybe.details,
      );
    }
    return new DesktopIpcError(DesktopIpcErrorCode.INTERNAL, maybe.message);
  }
  return new DesktopIpcError(
    DesktopIpcErrorCode.INTERNAL,
    error instanceof Error ? error.message : String(error),
  );
}

/** Electron strips custom Error fields across IPC — return this envelope instead. */
export type IpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: DesktopIpcErrorPayload };

export function ipcOk<T>(value: T): IpcResult<T> {
  return { ok: true, value };
}

export function ipcErr(error: DesktopIpcError): IpcResult<never> {
  return { ok: false, error: serializeDesktopIpcError(error) };
}

export function isIpcResult(value: unknown): value is IpcResult<unknown> {
  if (typeof value !== "object" || value === null) return false;
  const row = value as { ok?: unknown };
  if (row.ok === true) return "value" in row;
  if (row.ok === false) {
    return isDesktopIpcErrorPayload((row as { error?: unknown }).error);
  }
  return false;
}

export function unwrapIpcResult<T>(result: IpcResult<T>): T {
  if (result.ok) return result.value;
  throw new DesktopIpcError(
    result.error.code,
    result.error.message,
    result.error.details,
  );
}
