import { randomUUID } from "node:crypto";

export type ApiErrorDetails = unknown;

export function requestId(request: Request): string {
  return request.headers.get("x-request-id")?.trim() || randomUUID();
}

export function jsonApiError(
  request: Request,
  status: number,
  code: string,
  message: string,
  details?: ApiErrorDetails,
): Response {
  const id = requestId(request);
  return Response.json(
    {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
        requestId: id,
      },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "x-request-id": id,
      },
    },
  );
}

export function jsonApi<T>(request: Request, body: T, init?: ResponseInit): Response {
  const id = requestId(request);
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("x-request-id", id);
  return Response.json(body, { ...init, headers });
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}
