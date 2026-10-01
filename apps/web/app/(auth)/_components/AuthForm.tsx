"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormEvent, useEffect, useState } from "react";
import { AuthShell } from "./AuthShell";
import { authClient } from "@/lib/api/auth-client";
import { continueMcpOAuth } from "@/lib/api/mcp-oauth";

type AuthMode = "login" | "register";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

/**
 * `oauth` turns the login form into the MCP OAuth sign-in step: after any
 * sign-in (or an already-existing session) the signed authorize query in the
 * URL is handed back to apps/api, which then sends the browser to consent.
 */
export function AuthForm({ mode, oauth = false }: { mode: AuthMode; oauth?: boolean }) {
  const t = useTranslations("AuthPage");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nextPath = safeNext(searchParams.get("next"));
  const isRegister = mode === "register";
  const oauthQuery = searchParams.toString();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [continuing, setContinuing] = useState(false);

  async function continueOAuth() {
    setContinuing(true);
    try {
      const { redirectUri } = await continueMcpOAuth(oauthQuery);
      window.location.href = redirectUri;
    } catch (caught) {
      setError(getErrorMessage(caught, t("errors.generic")));
      setContinuing(false);
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!oauth || sessionPending || !session || continuing) return;
    void continueOAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauth, sessionPending, session]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = isRegister
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: nextPath })
        : await authClient.signIn.email({ email: email.trim(), password, callbackURL: nextPath });

      if (result.error) {
        throw new Error(result.error.message || t("errors.generic"));
      }
      if (oauth) {
        await continueOAuth();
        return;
      }
      router.push(nextPath);
      router.refresh();
    } catch (caught) {
      setError(getErrorMessage(caught, t("errors.generic")));
      setSubmitting(false);
    }
  }

  async function continueWithGoogle() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: oauth
          ? `${window.location.origin}${window.location.pathname}?${oauthQuery}`
          : `${window.location.origin}${nextPath}`,
      });
      if (result.error) throw new Error(result.error.message || t("errors.google"));
    } catch (caught) {
      setError(getErrorMessage(caught, t("errors.google")));
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">{t("eyebrow")}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-[var(--fg-primary)]">{t(oauth ? "oauthTitle" : isRegister ? "registerTitle" : "loginTitle")}</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--fg-secondary)]">{t(oauth ? "oauthDescription" : isRegister ? "registerDescription" : "loginDescription")}</p>

            <button type="button" onClick={() => void continueWithGoogle()} disabled={submitting || continuing} className="mt-8 inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-sm font-semibold text-[var(--fg-primary)] transition hover:border-[#65c4ed] hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-60">
              <span className="grid size-6 place-items-center rounded-full bg-white text-sm font-bold text-[#4285f4] shadow-sm">G</span>
              {t("continueGoogle")}
            </button>

            <div className="my-7 flex items-center gap-3 text-xs text-[var(--fg-muted)]"><span className="h-px flex-1 bg-[var(--border-subtle)]" /><span>{t("or")}</span><span className="h-px flex-1 bg-[var(--border-subtle)]" /></div>

            <form className="space-y-4" onSubmit={(event) => void submit(event)}>
              {isRegister ? <label className="block"><span className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">{t("nameLabel")}</span><input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-sm text-[var(--fg-primary)] outline-none transition hover:border-[#65c4ed] focus:border-[#65c4ed] focus:ring-2 focus:ring-[#65c4ed]/20" placeholder={t("namePlaceholder")} /></label> : null}
              <label className="block"><span className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">{t("emailLabel")}</span><input id="auth-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-sm text-[var(--fg-primary)] outline-none transition hover:border-[#65c4ed] focus:border-[#65c4ed] focus:ring-2 focus:ring-[#65c4ed]/20" placeholder={t("emailPlaceholder")} /></label>
              <label className="block"><span className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">{t("passwordLabel")}</span><input required minLength={8} type="password" autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-sm text-[var(--fg-primary)] outline-none transition hover:border-[#65c4ed] focus:border-[#65c4ed] focus:ring-2 focus:ring-[#65c4ed]/20" placeholder={t("passwordPlaceholder")} /></label>
              {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm leading-5 text-red-700">{error}</p> : null}
              <button type="submit" disabled={submitting || continuing} className="h-12 w-full rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-on)] shadow-sm transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60">{submitting || continuing ? t("submitting") : t(isRegister ? "registerButton" : "loginButton")}</button>
            </form>

            {oauth ? null : <p className="mt-7 text-center text-sm text-[var(--fg-secondary)]">{t(isRegister ? "alreadyAccount" : "newAccount")} <Link href={isRegister ? "/login" : "/register"} className="font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline">{t(isRegister ? "loginLink" : "registerLink")}</Link></p>}
            <p className="mt-8 text-center text-xs leading-5 text-[var(--fg-muted)]">{t("terms")}</p>
    </AuthShell>
  );
}
