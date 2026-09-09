import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ProjectRepositoryError,
  type ProjectActor,
  type ProjectClient,
} from "./repository";

export async function authenticatedProjectContext(): Promise<{
  client: ProjectClient;
  actor: ProjectActor;
}> {
  let client: ProjectClient;
  try {
    client = await createSupabaseServerClient();
  } catch {
    throw new ProjectRepositoryError("Authentication is not configured", "UNAUTHENTICATED");
  }

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new ProjectRepositoryError("Authentication required", "UNAUTHENTICATED");
  }
  return { client, actor: { userId: data.user.id } };
}

export function projectErrorStatus(code: ProjectRepositoryError["code"]): number {
  switch (code) {
    case "UNAUTHENTICATED": return 401;
    case "FORBIDDEN": return 403;
    case "NOT_FOUND": return 404;
    case "REVISION_CONFLICT": return 409;
    case "INVALID_DOCUMENT": return 422;
    default: return 500;
  }
}

