"use client";

import { createAuthClient } from "better-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getMcpOAuthClient, submitMcpOAuthConsent } from "@/lib/api/mcp-oauth";

// Talks directly to apps/api's Better Auth instance - see
// app/mcp/sign-in/page.tsx's header comment for the same
// "deliberately separate from apps/web's own login" note.
const mcpAuthClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
  fetchOptions: { credentials: "include" },
});

// Standalone consent page for the MCP OAuth 2.1 authorization flow -
// apps/api's Better Auth `mcp()` plugin redirects here once the browser has
// a session but hasn't approved this client/scope combination yet.
function ConsentContent() {
  const searchParams = useSearchParams();
  const oauthQuery = searchParams.toString();
  const clientId = searchParams.get("client_id") ?? "";
  const requestedScopes = (searchParams.get("scope") ?? "").split(" ").filter(Boolean);

  const { data: session, isPending: sessionPending } = mcpAuthClient.useSession();
  const [clientName, setClientName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lookedUpClient, setLookedUpClient] = useState(false);

  useEffect(() => {
    if (sessionPending || !session || lookedUpClient || !clientId) return;
    setLookedUpClient(true);
    getMcpOAuthClient(clientId)
      .then((client) => setClientName(client.name))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [sessionPending, session, lookedUpClient, clientId]);

  async function respond(accept: boolean): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const { redirectUrl } = await submitMcpOAuthConsent(accept, oauthQuery);
      window.location.href = redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  if (sessionPending) return <p>{"Loading…"}</p>;

  if (!session) {
    if (typeof window !== "undefined") window.location.href = `/mcp/sign-in?${oauthQuery}`;
    return <p>{"Redirecting to sign in…"}</p>;
  }

  return (
    <>
      <h1>Authorize access</h1>
      <p>
        <strong>{clientName ?? clientId}</strong> wants to access your Neonix account.
      </p>
      {requestedScopes.length > 0 && (
        <ul>
          {requestedScopes.map((scope) => (
            <li key={scope}>{scope}</li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" style={{ color: "crimson" }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button type="button" disabled={submitting} onClick={() => void respond(true)}>
          Approve
        </button>
        <button type="button" disabled={submitting} onClick={() => void respond(false)}>
          Deny
        </button>
      </div>
    </>
  );
}

export default function McpConsentPage() {
  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <Suspense fallback={<p>{"Loading…"}</p>}>
        <ConsentContent />
      </Suspense>
    </main>
  );
}
