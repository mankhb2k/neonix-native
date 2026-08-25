"use client";

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
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", nextPath || "/app");

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
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", nextPath || "/app");

      result = isRegister
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: redirectTo.toString() },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to sign in.",
      );
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

    window.location.assign(nextPath || "/app");
  }

  const isRegister = mode === "register";
  const switchHref = isRegister ? "/login" : "/register";
  const switchUrl = nextPath
    ? `${switchHref}?next=${encodeURIComponent(nextPath)}`
    : switchHref;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg-site)] px-5 py-10 text-[var(--fg-primary)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 12% 10%, rgba(34,211,238,0.16), transparent 32%), radial-gradient(circle at 88% 90%, rgba(192,132,252,0.14), transparent 34%)",
        }}
      />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--bg-surface)_82%,transparent)] shadow-[0_24px_100px_rgba(0,0,0,0.38)] backdrop-blur-xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden flex-col justify-between border-r border-[var(--border-subtle)] bg-[linear-gradient(145deg,rgba(34,211,238,0.12),transparent_48%,rgba(192,132,252,0.1))] p-10 lg:flex">
          <Link href="/" className="flex items-center gap-3 no-underline">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-lg font-bold text-cyan-200">
              N
            </span>
            <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
          </Link>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
              AI-first motion studio
            </p>
            <h2 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight">
              Turn an idea into a video you can keep editing.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--fg-muted)]">
              Connect your workspace with Claude, shape the story, and open the
              editor whenever you want to refine the details.
            </p>
          </div>
          <p className="text-xs text-[var(--fg-disabled)]">Built for editable motion.</p>
        </section>

        <section className="flex min-h-[560px] flex-col justify-center p-6 sm:p-10">
          <div className="mx-auto w-full max-w-sm">
            <Link
              href="/"
              className="mb-10 inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--fg-primary)] no-underline lg:hidden"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-sm text-cyan-200">
                N
              </span>
              {APP_NAME}
            </Link>

            <div className="mb-8">
              <p className="mb-3 text-sm font-medium text-cyan-200">Welcome to {APP_NAME}</p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {isRegister ? "Create your account" : "Welcome back"}
              </h1>
              <p className="mt-3 text-sm leading-6 text-[var(--fg-muted)]">
                {isRegister
                  ? "Start creating editable motion videos with Claude."
                  : "Sign in to continue to your workspace and projects."}
              </p>
            </div>

            <form onSubmit={submitEmailAuth} className="space-y-4">
              <div>
                <label htmlFor="auth-email" className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">
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
                  className="h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-editor)] px-4 text-sm text-[var(--fg-primary)] outline-none transition placeholder:text-[var(--fg-disabled)] focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="auth-password" className="block text-sm font-medium text-[var(--fg-secondary)]">
                    Password
                  </label>
                </div>
                <input
                  id="auth-password"
                  name="password"
                  type="password"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                  className="h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-editor)] px-4 text-sm text-[var(--fg-primary)] outline-none transition placeholder:text-[var(--fg-disabled)] focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                />
              </div>
              {isRegister ? (
                <div>
                  <label htmlFor="auth-confirm-password" className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">
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
                    className="h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-editor)] px-4 text-sm text-[var(--fg-primary)] outline-none transition placeholder:text-[var(--fg-disabled)] focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                  />
                </div>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="h-12 w-full rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-on)] shadow-[0_8px_24px_rgba(34,211,238,0.2)] transition hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-wait disabled:opacity-60"
              >
                {loading
                  ? "Please wait…"
                  : isRegister
                    ? "Create account"
                    : "Log in"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs text-[var(--fg-disabled)]">
              <span className="h-px flex-1 bg-[var(--border-subtle)]" />
              <span>or continue with</span>
              <span className="h-px flex-1 bg-[var(--border-subtle)]" />
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={loading}
              aria-busy={loading}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[var(--border-strong)] bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-wait disabled:opacity-60"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                <path fill="#4285F4" d="M21.35 12.2c0-.72-.06-1.42-.18-2.1H12v3.98h5.24a4.5 4.5 0 0 1-1.94 2.95v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.28Z" />
                <path fill="#34A853" d="M12 21.7c2.63 0 4.84-.87 6.45-2.37l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.29v2.53A9.74 9.74 0 0 0 12 21.7Z" />
                <path fill="#FBBC05" d="M6.53 13.77a5.86 5.86 0 0 1 0-3.54V7.7H3.29a9.72 9.72 0 0 0 0 8.6l3.24-2.53Z" />
                <path fill="#EA4335" d="M12 6.2c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.3 14.63 2.3 12 2.3a9.74 9.74 0 0 0-8.71 5.4l3.24 2.53C7.3 7.92 9.46 6.2 12 6.2Z" />
              </svg>
              {loading
                ? "Redirecting to Google…"
                : isRegister
                  ? "Sign up with Google"
                  : "Continue with Google"}
            </button>

            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-sm leading-5 text-rose-200"
              >
                {error}
              </p>
            ) : null}

            {message ? (
              <p className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm leading-5 text-emerald-200">
                {message}
              </p>
            ) : null}

            <p className="mt-5 text-center text-xs text-[var(--fg-disabled)]">
              Secure authentication powered by Supabase Auth.
            </p>

            <p className="text-center text-sm text-[var(--fg-muted)]">
              {isRegister ? "Already have an account?" : "New to Neonix?"}{" "}
              <Link
                href={switchUrl}
                className="font-semibold text-cyan-200 underline decoration-cyan-200/30 underline-offset-4 hover:text-cyan-100"
              >
                {isRegister ? "Log in" : "Create an account"}
              </Link>
            </p>

            <p className="mt-8 text-center text-xs leading-5 text-[var(--fg-disabled)]">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
