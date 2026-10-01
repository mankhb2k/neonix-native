"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { mcpAuthClient } from "@/lib/api/mcp-auth-client";
import { getMcpOAuthClient, submitMcpOAuthConsent } from "@/lib/api/mcp-oauth";
import { AuthShell } from "../../../_components/AuthShell";

// Standalone consent page for the MCP OAuth 2.1 authorization flow -
// apps/api's Better Auth `mcp()` plugin redirects here once the browser has
// a session but hasn't approved this client/scope combination yet.
export function ConsentContent() {
  const t = useTranslations("AuthPage");
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

  if (sessionPending) {
    return (
      <AuthShell>
        <p className="text-sm text-[var(--fg-secondary)]">{t("loading")}</p>
      </AuthShell>
    );
  }

  if (!session) {
    if (typeof window !== "undefined") window.location.href = `/mcp/sign-in?${oauthQuery}`;
    return (
      <AuthShell>
        <p className="text-sm text-[var(--fg-secondary)]">{t("redirectingSignIn")}</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">{t("eyebrow")}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-[var(--fg-primary)]">{t("consentTitle")}</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--fg-secondary)]">
        {t("consentDescription", { client: clientName ?? clientId })}
      </p>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">{t("consentSignedInAs", { user: session.user.email })}</p>

      {requestedScopes.length > 0 && (
        <div className="mt-7 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-site)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">{t("consentPermissions")}</p>
          <ul className="mt-3 space-y-2">
            {requestedScopes.map((scope) => (
              <li key={scope} className="flex items-center gap-2 text-sm text-[var(--fg-primary)]">
                <span className="grid size-5 place-items-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-[var(--accent-on)]">✓</span>
                {t.has(`scopes.${scope}`) ? t(`scopes.${scope}`) : scope}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error ? <p role="alert" className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm leading-5 text-red-700">{error}</p> : null}

      <div className="mt-7 grid grid-cols-2 gap-3">
        <button type="button" disabled={submitting} onClick={() => void respond(false)} className="h-12 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-sm font-semibold text-[var(--fg-primary)] transition hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-60">{t("deny")}</button>
        <button type="button" disabled={submitting} onClick={() => void respond(true)} className="h-12 rounded-xl bg-[var(--accent)] text-sm font-semibold text-[var(--accent-on)] shadow-sm transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? t("submitting") : t("allow")}</button>
      </div>
      <p className="mt-6 text-center text-xs leading-5 text-[var(--fg-muted)]">{t("consentFooter")}</p>
    </AuthShell>
  );
}
