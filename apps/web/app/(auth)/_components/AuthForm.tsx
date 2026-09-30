"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/api/auth-client";

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

export function AuthForm({ mode }: { mode: AuthMode }) {
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
        callbackURL: `${window.location.origin}${nextPath}`,
      });
      if (result.error) throw new Error(result.error.message || t("errors.google"));
    } catch (caught) {
      setError(getErrorMessage(caught, t("errors.google")));
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg-site)] px-4 py-5 text-[var(--fg-primary)] sm:px-8 sm:py-8">
      <div
        data-testid="auth-card"
        className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-[1180px] overflow-hidden rounded-[28px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[0_24px_80px_rgba(23,23,23,0.08)] lg:min-h-[720px] lg:grid-cols-[1.08fr_0.92fr]"
      >
        <section className="relative hidden overflow-hidden bg-[#0b2530] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute -right-24 -top-24 size-80 rounded-full border border-[#65c4ed]/30 bg-[#65c4ed]/10 blur-sm" />
          <div className="absolute -bottom-36 -left-28 size-96 rounded-full border border-[#16b8a8]/30 bg-[#16b8a8]/10" />
          <div className="relative">
            <Link href="/" className="inline-flex items-center gap-3 no-underline">
              <Image src="/neonix-logo.svg" alt="Neonix" width={54} height={40} className="h-9 w-auto" priority />
              <span className="text-xl font-semibold tracking-[-0.03em]">Neonix</span>
            </Link>
            <p className="mt-24 max-w-md text-sm font-semibold uppercase tracking-[0.2em] text-[#65c4ed]">{t("eyebrow")}</p>
            <h2 className="mt-5 max-w-xl font-[var(--font-display)] text-5xl leading-[1.05] tracking-[-0.045em] xl:text-6xl">{t("panelTitle")}</h2>
            <p className="mt-7 max-w-lg text-base leading-7 text-white/70">{t("panelDescription")}</p>
          </div>
          <p className="relative max-w-sm text-sm leading-6 text-white/50">{t("panelFooter")}</p>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-12 lg:px-14 xl:px-20">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <Link href="/" className="inline-flex items-center gap-3 no-underline">
                <Image src="/neonix-logo.svg" alt="Neonix" width={48} height={36} className="h-8 w-auto" priority />
                <span className="text-xl font-semibold tracking-[-0.03em]">Neonix</span>
              </Link>
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">{t("eyebrow")}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-[var(--fg-primary)]">{t(isRegister ? "registerTitle" : "loginTitle")}</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--fg-secondary)]">{t(isRegister ? "registerDescription" : "loginDescription")}</p>

            <button type="button" onClick={() => void continueWithGoogle()} disabled={submitting} className="mt-8 inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-sm font-semibold text-[var(--fg-primary)] transition hover:border-[#65c4ed] hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-60">
              <span className="grid size-6 place-items-center rounded-full bg-white text-sm font-bold text-[#4285f4] shadow-sm">G</span>
              {t("continueGoogle")}
            </button>

            <div className="my-7 flex items-center gap-3 text-xs text-[var(--fg-muted)]"><span className="h-px flex-1 bg-[var(--border-subtle)]" /><span>{t("or")}</span><span className="h-px flex-1 bg-[var(--border-subtle)]" /></div>

            <form className="space-y-4" onSubmit={(event) => void submit(event)}>
              {isRegister ? <label className="block"><span className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">{t("nameLabel")}</span><input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-sm text-[var(--fg-primary)] outline-none transition hover:border-[#65c4ed] focus:border-[#65c4ed] focus:ring-2 focus:ring-[#65c4ed]/20" placeholder={t("namePlaceholder")} /></label> : null}
              <label className="block"><span className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">{t("emailLabel")}</span><input id="auth-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-sm text-[var(--fg-primary)] outline-none transition hover:border-[#65c4ed] focus:border-[#65c4ed] focus:ring-2 focus:ring-[#65c4ed]/20" placeholder={t("emailPlaceholder")} /></label>
              <label className="block"><span className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">{t("passwordLabel")}</span><input required minLength={8} type="password" autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-sm text-[var(--fg-primary)] outline-none transition hover:border-[#65c4ed] focus:border-[#65c4ed] focus:ring-2 focus:ring-[#65c4ed]/20" placeholder={t("passwordPlaceholder")} /></label>
              {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm leading-5 text-red-700">{error}</p> : null}
              <button type="submit" disabled={submitting} className="h-12 w-full rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-on)] shadow-sm transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? t("submitting") : t(isRegister ? "registerButton" : "loginButton")}</button>
            </form>

            <p className="mt-7 text-center text-sm text-[var(--fg-secondary)]">{t(isRegister ? "alreadyAccount" : "newAccount")} <Link href={isRegister ? "/login" : "/register"} className="font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline">{t(isRegister ? "loginLink" : "registerLink")}</Link></p>
            <p className="mt-8 text-center text-xs leading-5 text-[var(--fg-muted)]">{t("terms")}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
