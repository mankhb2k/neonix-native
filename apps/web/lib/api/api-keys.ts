import { apiFetch } from "./client";

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type CreatedApiKey = ApiKey & { token: string };

async function readError(response: Response, fallback: string): Promise<Error> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    return new Error(message || fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const response = await apiFetch("/v1/api-keys", { cache: "no-store" });
  if (!response.ok) throw await readError(response, "Could not load API keys.");
  return (await response.json()) as ApiKey[];
}

export async function createApiKey(name?: string): Promise<CreatedApiKey> {
  const response = await apiFetch("/v1/api-keys", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(name ? { name } : {}),
  });
  if (!response.ok) throw await readError(response, "Could not create API key.");
  return (await response.json()) as CreatedApiKey;
}

export async function renameApiKey(id: string, name: string): Promise<ApiKey> {
  const response = await apiFetch(`/v1/api-keys/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw await readError(response, "Could not rename API key.");
  return (await response.json()) as ApiKey;
}

export async function revokeApiKey(id: string): Promise<void> {
  const response = await apiFetch(`/v1/api-keys/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw await readError(response, "Could not revoke API key.");
}
