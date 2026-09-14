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

    window.location.assign(nextPath || "/dashboard");
  }

  const isRegister = mode === "register";
  const switchHref = isRegister ? "/login" : "/register";
  const switchUrl = nextPath
    ? `${switchHref}?next=${encodeURIComponent(nextPath)}`
    : switchHref;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4fbfd] px-5 py-10 text-[#111827]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 12% 10%, rgba(61,213,238,0.22), transparent 32%), radial-gradient(circle at 88% 90%, rgba(192,132,252,0.15), transparent 34%)",
        }}
      />

      <div data-testid="auth-card" className="relative grid w-full max-w-[1120px] overflow-hidden rounded-[22px] border border-[#dbe7eb] bg-white/85 shadow-[0_24px_80px_rgba(15,41,54,0.18)] backdrop-blur-xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden flex-col justify-between border-r border-[#dbe7eb] bg-[linear-gradient(145deg,rgba(89,216,239,0.13),transparent_48%,rgba(192,132,252,0.09))] p-10 lg:flex">
          <Link href="/" className="flex items-center gap-3 no-underline">
            <Image src="/neonix-logo.svg" alt="" width={38} height={28} priority className="h-7 w-auto" />
            <span className="text-lg font-semibold tracking-tight text-[#1685c9]">{APP_NAME}</span>
          </Link>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#52cfe8]">
              Claude-connected motion studio
            </p>
            <h2 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight text-[#111827]">
              Turn an idea into a video you can keep editing.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#6b7280]">
              Connect your workspace with Claude, shape the story, and open the
              editor whenever you want to refine the details.
            </p>
          </div>
          <p className="text-xs text-[#9ca3af]">Built for editable motion.</p>
        </section>

        <section className="flex min-h-[560px] flex-col justify-center bg-white/75 p-6 sm:p-10">
          <div className="mx-auto w-full max-w-sm">
            <Link
              href="/"
              className="mb-10 inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-[#1685c9] no-underline lg:hidden"
            >
              <Image src="/neonix-logo.svg" alt="" width={32} height={24} priority className="h-6 w-auto" />
              {APP_NAME}
            </Link>

            <div className="mb-8">
              <p className="mb-3 text-sm font-medium text-[#5ed8ef]">Welcome to {APP_NAME}</p>
              <h1 className="text-3xl font-semibold tracking-tight text-[#111827] sm:text-4xl">
                {isRegister ? "Create your account" : "Welcome back"}
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#6b7280]">
                {isRegister
                  ? "Start creating editable motion videos with Claude."
                  : "Sign in to continue to your workspace and projects."}
              </p>
            </div>

            <form onSubmit={submitEmailAuth} className="space-y-4">
              <div>
                <label htmlFor="auth-email" className="mb-2 block text-sm font-medium text-[#4b5563]">
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
                  className="h-12 w-full rounded-xl border border-[#cbd5dc] bg-[#fbfcfd] px-4 text-sm text-[#111827] outline-none transition hover:border-[#65c4ed] hover:bg-[#f1fbff] placeholder:text-[#9ca3af] focus:border-[#19a6d8] focus:bg-white focus:ring-2 focus:ring-[#19a6d8]/20"
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="auth-password" className="block text-sm font-medium text-[#4b5563]">
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
                  className="h-12 w-full rounded-xl border border-[#cbd5dc] bg-[#fbfcfd] px-4 text-sm text-[#111827] outline-none transition hover:border-[#65c4ed] hover:bg-[#f1fbff] placeholder:text-[#9ca3af] focus:border-[#19a6d8] focus:bg-white focus:ring-2 focus:ring-[#19a6d8]/20"
                />
              </div>
              {isRegister ? (
                <div>
                  <label htmlFor="auth-confirm-password" className="mb-2 block text-sm font-medium text-[#4b5563]">
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
                    className="h-12 w-full rounded-xl border border-[#cbd5dc] bg-[#fbfcfd] px-4 text-sm text-[#111827] outline-none transition hover:border-[#65c4ed] hover:bg-[#f1fbff] placeholder:text-[#9ca3af] focus:border-[#19a6d8] focus:bg-white focus:ring-2 focus:ring-[#19a6d8]/20"
                  />
                </div>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="h-12 w-full rounded-xl bg-[#109e96] px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(16,158,150,0.2)] transition hover:bg-[#0c8c85] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19a6d8] disabled:cursor-wait disabled:opacity-60"
              >
                {loading
                  ? "Please waitâ€¦"
                  : isRegister
                    ? "Create account"
                    : "Log in"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs text-[#9ca3af]">
              <span className="h-px flex-1 bg-[#dbe3e7]" />
              <span>or continue with</span>
              <span className="h-px flex-1 bg-[#dbe3e7]" />
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={loading}
              aria-busy={loading}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#cbd5dc] bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-[#65c4ed] hover:bg-[#f3fbff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19a6d8] disabled:cursor-wait disabled:opacity-60"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                <path fill="#4285F4" d="M21.35 12.2c0-.72-.06-1.42-.18-2.1H12v3.98h5.24a4.5 4.5 0 0 1-1.94 2.95v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.28Z" />
                <path fill="#34A853" d="M12 21.7c2.63 0 4.84-.87 6.45-2.37l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.29v2.53A9.74 9.74 0 0 0 12 21.7Z" />
                <path fill="#FBBC05" d="M6.53 13.77a5.86 5.86 0 0 1 0-3.54V7.7H3.29a9.72 9.72 0 0 0 0 8.6l3.24-2.53Z" />
                <path fill="#EA4335" d="M12 6.2c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.3 14.63 2.3 12 2.3a9.74 9.74 0 0 0-8.71 5.4l3.24 2.53C7.3 7.92 9.46 6.2 12 6.2Z" />
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
                className="mt-4 rounded-xl border border-rose-300/40 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700"
              >
                {error}
              </p>
            ) : null}

            {message ? (
              <p className="mt-4 rounded-xl border border-emerald-300/40 bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-700">
                {message}
              </p>
            ) : null}

            <p className="mt-5 text-center text-xs text-[#9ca3af]">
              Secure authentication powered by Supabase Auth.
            </p>

            <p className="text-center text-sm text-[#6b7280]">
              {isRegister ? "Already have an account?" : "New to Neonix?"}{" "}
              <Link
                href={switchUrl}
                className="font-semibold text-[#25b9ed] underline decoration-[#25b9ed]/30 underline-offset-4 hover:text-[#1685c9]"
              >
                {isRegister ? "Log in" : "Create an account"}
              </Link>
            </p>

            <p className="mt-8 text-center text-xs leading-5 text-[#9ca3af]">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}


