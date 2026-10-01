// Talks directly to apps/api's Better Auth OAuth 2.1 provider for MCP
// clients - see apps/api/src/auth/auth.ts's `mcp()` plugin and
// app/(auth)/mcp/sign-in, app/(auth)/mcp/consent (the only callers). Cross-origin from
// apps/web, hence `credentials: "include"` on every call.

import { apiFetch } from "./client";

type OAuthErrorBody = { error_description?: string; error?: string };

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as OAuthErrorBody;
    return body.error_description ?? body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export type ContinueOAuthResult = {
  redirectUri: string;
};

/** Resumes the OAuth2 authorization flow after the user just signed in. */
export async function continueMcpOAuth(oauthQuery: string): Promise<ContinueOAuthResult> {
  const response = await apiFetch("/api/auth/oauth2/continue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    // The provider rejects the call ("Missing parameters") unless one of
    // selected/created/postLogin is true; `selected` re-runs authorize with the
    // stored query now that the browser has a session.
    body: JSON.stringify({ selected: true, oauth_query: oauthQuery }),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response, "Could not continue sign-in."));
  const body = (await response.json()) as { redirect_uri: string };
  return { redirectUri: body.redirect_uri };
}

export type McpOAuthClientInfo = {
  name: string;
};

/** Publicly visible display fields for the client the user is about to authorize. */
export async function getMcpOAuthClient(clientId: string): Promise<McpOAuthClientInfo> {
  const response = await apiFetch(`/api/auth/oauth2/public-client?client_id=${encodeURIComponent(clientId)}`);
  if (!response.ok) throw new Error(await readErrorMessage(response, "Could not load application details."));
  const body = (await response.json()) as { client_name?: string; name?: string };
  return { name: body.client_name ?? body.name ?? clientId };
}

export type SubmitConsentResult = {
  redirectUrl: string;
};

/** Records the user's accept/deny decision and returns where to send the browser next. */
export async function submitMcpOAuthConsent(accept: boolean, oauthQuery: string): Promise<SubmitConsentResult> {
  const response = await apiFetch("/api/auth/oauth2/consent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accept, oauth_query: oauthQuery }),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response, "Could not process your response."));
  const body = (await response.json()) as { url: string };
  return { redirectUrl: body.url };
}
