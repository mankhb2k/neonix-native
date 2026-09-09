import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  getCurrentUser,
} from "@/lib/supabase/server";

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const { authorization_id: authorizationId } = await searchParams;
  if (!authorizationId) {
    return <main>Missing authorization_id.</main>;
  }

  const user = await getCurrentUser();
  if (!user) {
    const nextPath = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: details, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

  if (error || !details) {
    return <main>Invalid or expired OAuth request.</main>;
  }

  if (!("authorization_id" in details)) {
    redirect(details.redirect_url);
  }

  const scopes = details.scope.split(" ").filter(Boolean);

  return (
    <main className="min-h-screen bg-[var(--bg-site)] px-6 py-16 text-[var(--fg-primary)] sm:py-24">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex items-center gap-3 text-sm font-semibold tracking-[0.12em] text-[var(--fg-primary)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]">
            N
          </span>
          NEONIX
        </div>

        <section className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-7 shadow-2xl shadow-black/20 sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">
            Authorization request
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Connect {details.client.name} to Neonix?
          </h1>
          <p className="mt-4 leading-7 text-[var(--fg-secondary)]">
            This application is requesting access to act on your behalf in
            your current Neonix workspace. You can revoke access later from
            your account settings.
          </p>

          <div className="mt-7 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-site)] p-4">
            <p className="text-sm text-[var(--fg-muted)]">Requesting application</p>
            <p className="mt-1 font-medium text-[var(--fg-primary)]">{details.client.name}</p>
            <p className="mt-4 text-sm text-[var(--fg-muted)]">Requested permissions</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {(scopes.length ? scopes : ["basic access"]).map((scope) => (
                <li
                  key={scope}
                  className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1 text-xs text-[var(--fg-secondary)]"
                >
                  {scope}
                </li>
              ))}
            </ul>
          </div>

          <form action="/api/oauth/decision" method="post" className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <input type="hidden" name="authorization_id" value={authorizationId} />
            <button
              type="submit"
              name="decision"
              value="deny"
              className="rounded-lg border border-[var(--border-strong)] px-5 py-3 text-sm font-medium text-[var(--fg-secondary)] transition hover:border-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
            >
              Deny
            </button>
            <button
              type="submit"
              name="decision"
              value="approve"
              className="rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-on)] transition hover:bg-[var(--accent-hover)]"
            >
              Allow access
            </button>
          </form>

          <p className="mt-5 text-center text-xs leading-5 text-[var(--fg-muted)]">
            You will be returned to ChatGPT after choosing an option.
          </p>
        </section>
      </div>
    </main>
  );
}
