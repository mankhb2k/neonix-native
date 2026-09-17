/** Resolve the authenticated account that owns a render job. */

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function resolveRequestUserId(request: Request): Promise<string | null> {
  const header = request.headers.get("x-user-id");
  if (process.env.NODE_ENV !== "production" && header && header.trim()) return header.trim();
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) return data.user.id;
  } catch {
    // Production routes return 401 when the session cannot be resolved.
  }
  return process.env.NODE_ENV === "production" ? null : "anonymous";
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
