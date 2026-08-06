/**
 * Ownership / auth stubs for render BFF.
 */

export function resolveRequestUserId(request: Request): string {
  const header = request.headers.get("x-user-id");
  if (header && header.trim()) return header.trim();
  // Dev fallback — production must require auth middleware.
  return "anonymous";
}

export function buildIdempotencyKey(input: {
  userId: string;
  projectId: string;
  projectRevision: number;
  preset: string;
  clientKey?: string;
}): string {
  if (input.clientKey?.trim()) return input.clientKey.trim();
  return `${input.userId}:${input.projectId}:${input.projectRevision}:${input.preset}`;
}
