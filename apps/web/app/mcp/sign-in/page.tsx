"use client";

import { createAuthClient } from "better-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { continueMcpOAuth } from "@/lib/api/mcp-oauth";

// Talks directly to apps/api's Better Auth instance - deliberately separate
// from apps/web's own login (still Supabase Auth, lib/supabase/*). Only
// this page and app/mcp/consent use it.
const mcpAuthClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
});

// Standalone login page for the MCP OAuth 2.1 authorization flow (apps/api's
// Better Auth `mcp()` plugin redirects here when a browser hits /oauth2/authorize
// without a session - see apps/api/src/auth/auth.ts). This authenticates
// against apps/api directly, for MCP clients (Claude, ChatGPT, Codex, etc.) only.
function SignInContent() {
  const searchParams = useSearchParams();
  const oauthQuery = searchParams.toString();
  const { data: session, isPending } = mcpAuthClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);

  useEffect(() => {
    if (isPending || !session || continuing) return;
    setContinuing(true);
    continueMcpOAuth(oauthQuery)
      .then(({ redirectUri }) => {
        window.location.href = redirectUri;
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setContinuing(false);
      });
  }, [isPending, session, continuing, oauthQuery]);

  if (isPending || (session && !error)) {
    return <p>{error ?? "Signing you in…"}</p>;
  }

  return (
    <>
      <h1>Sign in to continue</h1>
      <p>An application wants to connect to your Neonix account.</p>
      {error && (
        <p role="alert" style={{ color: "crimson" }}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() =>
          void mcpAuthClient.signIn.social({
            provider: "google",
            callbackURL: `${window.location.origin}${window.location.pathname}?${oauthQuery}`,
          })
        }
      >
        Continue with Google
      </button>
    </>
  );
}

export default function McpSignInPage() {
  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <Suspense fallback={<p>{"Loading…"}</p>}>
        <SignInContent />
      </Suspense>
    </main>
  );
}
