"use client";

import { Camera, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LogOut, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { removeAvatar, uploadAvatar } from "@/lib/api/avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AccountState = {
  avatarPath: string | null;
  avatarUrl: string | null;
  email: string;
  name: string;
  providers: string[];
};

export function SettingsWorkspace() {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("avatar_url, avatar_path")
          .eq("id", user.id)
          .maybeSingle();
        if (profileError) throw profileError;

        const metadataName =
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name.trim()
            : "";
        setAccount({
          avatarPath: typeof profile?.avatar_path === "string" ? profile.avatar_path : null,
          avatarUrl:
            typeof profile?.avatar_url === "string"
              ? profile.avatar_url
              : typeof user.user_metadata?.avatar_url === "string"
                ? user.user_metadata.avatar_url
                : null,
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

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarError(null);
    setUploadingAvatar(true);
    try {
      const result = await uploadAvatar(file);
      setAccount((current) =>
        current ? { ...current, avatarPath: result.avatarPath, avatarUrl: result.avatarUrl } : current,
      );
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Unable to upload your avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleAvatarRemove() {
    setAvatarError(null);
    setUploadingAvatar(true);
    try {
      const result = await removeAvatar();
      setAccount((current) => (current ? { ...current, avatarPath: null, avatarUrl: result.avatarUrl } : current));
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Unable to remove your avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError("Use at least 8 characters for your password.");
      return;
    }

    if (hasPasswordProvider && currentPassword.length === 0) {
      setPasswordError("Enter your current password to continue.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        ...(hasPasswordProvider ? { current_password: currentPassword } : {}),
      });
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setAccount((current) =>
        current && !current.providers.includes("email")
          ? { ...current, providers: [...current.providers, "email"] }
          : current,
      );
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
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-lg font-semibold text-[var(--hub-accent)]">
                {account.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={account.avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  account.name.slice(0, 1).toUpperCase()
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--fg-primary)]">
                  <UserRound className="size-4 text-[var(--hub-accent)]" />
                  Profile
                </h2>
                <p className="mt-3 text-sm font-medium text-[var(--fg-primary)]">{account.name}</p>
                <p className="mt-1 break-all text-sm text-[var(--fg-muted)]">{account.email || "No email address"}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="settings-avatar"
                    className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] px-3 text-sm font-semibold text-[var(--fg-primary)] transition hover:border-[var(--border-focus)] hover:bg-[var(--hub-hover)]"
                  >
                    {uploadingAvatar ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                    {uploadingAvatar ? "Saving…" : account.avatarPath ? "Change avatar" : "Upload avatar"}
                  </label>
                  <input
                    id="settings-avatar"
                    name="avatar"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    disabled={uploadingAvatar}
                    onChange={handleAvatarUpload}
                  />
                  {account.avatarPath ? (
                    <button
                      type="button"
                      onClick={() => void handleAvatarRemove()}
                      disabled={uploadingAvatar}
                      className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-[var(--fg-muted)] transition hover:bg-[var(--hub-hover)] hover:text-[var(--fg-primary)] disabled:cursor-wait disabled:opacity-60"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                {avatarError ? <p role="alert" className="mt-2 text-sm text-rose-300">{avatarError}</p> : null}
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
              {hasPasswordProvider ? (
                <div>
                  <label htmlFor="settings-current-password" className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">
                    Current password
                  </label>
                  <div className="relative">
                    <input
                      id="settings-current-password"
                      name="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      placeholder="Enter your current password"
                      className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-editor)] px-3 pr-11 text-sm text-[var(--fg-primary)] outline-none transition placeholder:text-[var(--fg-disabled)] hover:border-[var(--border-focus)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                    />
                    <button
                      type="button"
                      aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                      aria-pressed={showCurrentPassword}
                      onClick={() => setShowCurrentPassword((visible) => !visible)}
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--fg-muted)] transition hover:text-[var(--fg-primary)]"
                    >
                      {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              ) : null}
              <div>
                <label htmlFor="settings-new-password" className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">
                  {hasPasswordProvider ? "New password" : "Password"}
                </label>
                <div className="relative">
                  <input
                    id="settings-new-password"
                    name="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-editor)] px-3 pr-11 text-sm text-[var(--fg-primary)] outline-none transition placeholder:text-[var(--fg-disabled)] hover:border-[var(--border-focus)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                  />
                  <button
                    type="button"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                    aria-pressed={showNewPassword}
                    onClick={() => setShowNewPassword((visible) => !visible)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--fg-muted)] transition hover:text-[var(--fg-primary)]"
                  >
                    {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="settings-confirm-password" className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="settings-confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat your password"
                    className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-editor)] px-3 pr-11 text-sm text-[var(--fg-primary)] outline-none transition placeholder:text-[var(--fg-disabled)] hover:border-[var(--border-focus)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                  />
                  <button
                    type="button"
                    aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
                    aria-pressed={showConfirmPassword}
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--fg-muted)] transition hover:text-[var(--fg-primary)]"
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
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
                {savingPassword ? "Saving…" : hasPasswordProvider ? "Change password" : "Set password"}
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
