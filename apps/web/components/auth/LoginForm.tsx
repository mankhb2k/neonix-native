"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { APP_NAME } from "@/lib/app-config";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm({
  mode,
  error: initialError,
  nextPath,
}: {
  mode: "login" | "register";
  error?: string;
  nextPath?: string;
}) {
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const redirectTo = new URL("/api/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", nextPath || "/dashboard");

      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectTo.toString() },
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to start Google sign-in.",
      );
      setLoading(false);
    }
  }

  async function submitEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    let result;
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = new URL("/api/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", nextPath || "/dashboard");

      result = isRegister
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: redirectTo.toString() },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
      setLoading(false);
      return;
    }

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    if (isRegister && !result.data.session) {
      setMessage("Account created. Check your email to confirm your address.");
      setLoading(false);
      return;
    }

    window.location.assign(nextPath || "/dashboard");
  }

  const isRegister = mode === "register";
  const switchHref = isRegister ? "/login" : "/register";
  const switchUrl = nextPath
    ? `${switchHref}?next=${encodeURIComponent(nextPath)}`
    : switchHref;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg-site)] px-5 py-10 text-[var(--fg-primary)]">
      <div
        data-testid="auth-card"
        className="relative grid w-full max-w-[900px] overflow-hidden rounded-[22px] border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-[0_24px_80px_rgba(16,24,40,0.14)] lg:grid-cols-[0.9fr_1.1fr]"
      >
        <section className="hidden flex-col justify-between border-r border-[var(--border-subtle)] bg-[var(--bg-site)] p-10 lg:flex">
          <Link href="/" className="flex items-center gap-3 no-underline">
            <Image
              src="/neonix-logo.svg"
              alt=""
              width={38}
              height={28}
              priority
              className="h-7 w-auto"
            />
            <span className="text-xl font-semibold tracking-tight text-[#111827]">
              {APP_NAME}
            </span>
          </Link>
          <div>
            <p className="mb-3 font-mono text-base font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">
              HTML/CSS compiler for motion
            </p>
            <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-[-0.025em] text-[var(--fg-primary)]">
              Turn HTML or JSON into editable motion videos.
            </h2>
            <p className="mt-4 max-w-md text-base leading-6 text-[var(--fg-secondary)]">
              Create, refine, preview, and export every project in one
              workspace.
            </p>
          </div>
          <p className="text-sm text-[var(--fg-muted)]">
            Built for editable motion.
          </p>
        </section>

        <section className="flex min-h-[560px] flex-col justify-center bg-[var(--bg-elevated)] p-6 sm:p-10">
          <div className="mx-auto w-full max-w-md">
            <Link
              href="/"
              className="mb-10 inline-flex items-center gap-2 text-base font-semibold tracking-tight text-[var(--fg-primary)] no-underline lg:hidden"
            >
              <Image
                src="/neonix-logo.svg"
                alt=""
                width={32}
                height={24}
                priority
                className="h-6 w-auto"
              />
              {APP_NAME}
            </Link>

            <div className="mb-8">
              <p className="mb-3 text-base font-medium text-[var(--accent-text)]">
                Welcome to {APP_NAME}
              </p>
              <h1 className="text-4xl font-semibold tracking-[-0.025em] text-[var(--fg-primary)] sm:text-5xl">
                {isRegister ? "Create your account" : "Welcome back"}
              </h1>
              <p className="mt-3 text-base leading-6 text-[var(--fg-secondary)]">
                {isRegister
                  ? "Start creating editable motion videos with Claude."
                  : "Sign in to continue to your workspace and projects."}
              </p>
            </div>

            <form onSubmit={submitEmailAuth} className="space-y-4">
              <div>
                <label
                  htmlFor="auth-email"
                  className="mb-2 block text-base font-medium text-[var(--fg-secondary)]"
                >
                  Email address
                </label>
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  className="h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-base text-[var(--fg-primary)] outline-none transition hover:border-[var(--accent)] placeholder:text-[var(--fg-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20"
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="auth-password"
                    className="block text-base font-medium text-[var(--fg-secondary)]"
                  >
                    Password
                  </label>
                </div>
                <input
                  id="auth-password"
                  name="password"
                  type="password"
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                  className="h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-base text-[var(--fg-primary)] outline-none transition hover:border-[var(--accent)] placeholder:text-[var(--fg-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20"
                />
              </div>
              {isRegister ? (
                <div>
                  <label
                    htmlFor="auth-confirm-password"
                    className="mb-2 block text-base font-medium text-[var(--fg-secondary)]"
                  >
                    Confirm password
                  </label>
                  <input
                    id="auth-confirm-password"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat your password"
                    minLength={8}
                    required
                    className="h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-base text-[var(--fg-primary)] outline-none transition hover:border-[var(--accent)] placeholder:text-[var(--fg-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20"
                  />
                </div>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="h-12 w-full rounded-xl bg-[var(--accent)] px-4 text-base font-semibold text-[var(--accent-on)] shadow-[0_8px_24px_rgba(13,148,136,0.2)] transition hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] disabled:cursor-wait disabled:opacity-60"
              >
                {loading
                  ? "Please waitâ€¦"
                  : isRegister
                    ? "Create account"
                    : "Log in"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-sm text-[var(--fg-muted)]">
              <span className="h-px flex-1 bg-[var(--border-subtle)]" />
              <span>or continue with</span>
              <span className="h-px flex-1 bg-[var(--border-subtle)]" />
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={loading}
              aria-busy={loading}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-base font-semibold text-[var(--fg-primary)] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] disabled:cursor-wait disabled:opacity-60"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                <path
                  fill="#4285F4"
                  d="M21.35 12.2c0-.72-.06-1.42-.18-2.1H12v3.98h5.24a4.5 4.5 0 0 1-1.94 2.95v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.28Z"
                />
                <path
                  fill="#34A853"
                  d="M12 21.7c2.63 0 4.84-.87 6.45-2.37l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.29v2.53A9.74 9.74 0 0 0 12 21.7Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.53 13.77a5.86 5.86 0 0 1 0-3.54V7.7H3.29a9.72 9.72 0 0 0 0 8.6l3.24-2.53Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 6.2c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.3 14.63 2.3 12 2.3a9.74 9.74 0 0 0-8.71 5.4l3.24 2.53C7.3 7.92 9.46 6.2 12 6.2Z"
                />
              </svg>
              {loading
                ? "Redirecting to Googleâ€¦"
                : isRegister
                  ? "Sign up with Google"
                  : "Continue with Google"}
            </button>

            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-rose-300/40 bg-rose-50 px-4 py-3 text-base leading-5 text-rose-700"
              >
                {error}
              </p>
            ) : null}

            {message ? (
              <p className="mt-4 rounded-xl border border-emerald-300/40 bg-emerald-50 px-4 py-3 text-base leading-5 text-emerald-700">
                {message}
              </p>
            ) : null}

            <p className="p-[12px] text-center text-base text-[var(--fg-secondary)]">
              {isRegister ? "Already have an account?" : "New to Neonix?"}{" "}
              <Link
                href={switchUrl}
                className="font-semibold text-[var(--accent-text)] underline decoration-[var(--accent-text)]/30 underline-offset-4 hover:text-[var(--accent)]"
              >
                {isRegister ? "Log in" : "Create an account"}
              </Link>
            </p>

            <p className="text-center text-sm leading-5 text-[var(--fg-muted)]">
              By continuing, you agree to our Terms of Service and Privacy
              Policy.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
