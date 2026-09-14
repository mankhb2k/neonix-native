"use client";

import { CheckCircle2, KeyRound, Loader2, LogOut, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AccountState = {
  email: string;
  name: string;
  providers: string[];
};

export function SettingsWorkspace() {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAccount() {
      setLoadingAccount(true);
      setAccountError(null);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: userData, error: userError } = await supabase.auth.getUser();
        const user = userData.user;

        if (!mounted) return;
        if (!user) {
          setAccount(null);
          return;
        }

        if (userError) throw userError;
        const { data: identityData, error: identityError } = await supabase.auth.getUserIdentities();
        if (identityError) throw identityError;

        const metadataName =
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name.trim()
            : "";
        setAccount({
          email: user.email ?? "",
          name: metadataName || user.email?.split("@")[0] || "Your account",
          providers: (identityData?.identities ?? []).map((identity) => identity.provider),
        });
      } catch (error) {
        if (!mounted) return;
        setAccountError(error instanceof Error ? error.message : "Unable to load your account.");
      } finally {
        if (mounted) setLoadingAccount(false);
      }
    }

    void loadAccount();
    const handleDemoAuth = () => void loadAccount();
    window.addEventListener("neonix:dev-demo-authenticated", handleDemoAuth);
    return () => {
      mounted = false;
      window.removeEventListener("neonix:dev-demo-authenticated", handleDemoAuth);
    };
  }, []);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError("Use at least 8 characters for your password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Your password has been updated.");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Unable to update your password.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.assign("/login?next=%2Fsettings");
  }

  const hasPasswordProvider = account?.providers.includes("email") ?? false;

  return (
    <div data-testid="settings-page" className="space-y-8">
      <div>
        <p className="mb-2 text-caption font-semibold tracking-[0.16em] text-[var(--hub-accent)] uppercase">
          Account
        </p>
        <h1 className="m-0 text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)] sm:text-4xl">
          Settings
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--fg-muted)]">
          Manage your Neonix profile and sign-in methods.
        </p>
      </div>

      {loadingAccount ? (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] p-5 text-sm text-[var(--fg-muted)]">
          <Loader2 className="size-4 animate-spin" />
          Loading account…
        </div>
      ) : accountError ? (
        <div role="alert" className="rounded-xl border border-rose-300/30 bg-rose-400/10 p-5 text-sm text-rose-200">
          {accountError}
        </div>
      ) : account ? (
        <>
          <section className="rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-lg font-semibold text-[var(--hub-accent)]">
                {account.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--fg-primary)]">
                  <UserRound className="size-4 text-[var(--hub-accent)]" />
                  Profile
                </h2>
                <p className="mt-3 text-sm font-medium text-[var(--fg-primary)]">{account.name}</p>
                <p className="mt-1 break-all text-sm text-[var(--fg-muted)]">{account.email || "No email address"}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 text-[var(--hub-accent)]" />
              <div>
                <h2 className="text-lg font-semibold text-[var(--fg-primary)]">Security</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--fg-muted)]">
                  Add an email password so you can sign in without Google, or update your existing one.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-lg border border-[var(--hub-border)] bg-[var(--bg-site)] p-3 text-sm">
              <KeyRound className="size-4 text-[var(--hub-accent)]" />
              <span className="text-[var(--fg-secondary)]">
                {hasPasswordProvider ? "Email/password sign-in is enabled." : "Google sign-in is enabled. Set a password to enable email sign-in."}
              </span>
            </div>

            <form onSubmit={handlePasswordSubmit} className="mt-6 max-w-xl space-y-4">
              <div>
                <label htmlFor="settings-new-password" className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">
                  {hasPasswordProvider ? "New password" : "Password"}
                </label>
                <input
                  id="settings-new-password"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-editor)] px-3 text-sm text-[var(--fg-primary)] outline-none transition placeholder:text-[var(--fg-disabled)] focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                />
              </div>
              <div>
                <label htmlFor="settings-confirm-password" className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">
                  Confirm password
                </label>
                <input
                  id="settings-confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat your password"
                  className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-editor)] px-3 text-sm text-[var(--fg-primary)] outline-none transition placeholder:text-[var(--fg-disabled)] focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                />
              </div>

              {passwordError ? <p role="alert" className="text-sm text-rose-300">{passwordError}</p> : null}
              {passwordMessage ? (
                <p role="status" className="flex items-center gap-2 text-sm text-emerald-300">
                  <CheckCircle2 className="size-4" />
                  {passwordMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={savingPassword}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--hub-accent)] px-4 text-sm font-semibold text-[var(--hub-accent-on)] transition hover:bg-[var(--hub-accent-hover)] disabled:cursor-wait disabled:opacity-60"
              >
                {savingPassword ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                {savingPassword ? "Saving…" : hasPasswordProvider ? "Update password" : "Set password"}
              </button>
            </form>
          </section>

          <section className="flex flex-col justify-between gap-4 rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] p-5 sm:flex-row sm:items-center sm:p-6">
            <div>
              <h2 className="text-base font-semibold text-[var(--fg-primary)]">Sign out</h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">End the current Neonix session on this browser.</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] px-3.5 text-sm font-semibold text-[var(--fg-primary)] transition hover:bg-[var(--hub-hover)]"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </section>
        </>
      ) : (
        <section className="rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] p-6">
          <h2 className="text-lg font-semibold text-[var(--fg-primary)]">Sign in to manage your profile</h2>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">Your profile and security settings are only available after sign-in.</p>
          <Link
            href="/login?next=%2Fsettings"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--hub-accent)] px-4 text-sm font-semibold text-[var(--hub-accent-on)] no-underline"
          >
            Go to sign in
          </Link>
        </section>
      )}
    </div>
  );
}
