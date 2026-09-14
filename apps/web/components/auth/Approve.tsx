import Image from "next/image";
import { MCP_PERMISSION_GROUPS } from "@/lib/mcp/permissions";

type ApproveProps = {
  authorizationId: string;
  clientName: string;
  scopes: string[];
  returnLabel?: string;
  preview?: boolean;
};

function DecisionButtons({ preview }: { preview: boolean }) {
  return (
    <>
      <button
        type={preview ? "button" : "submit"}
        name={preview ? undefined : "decision"}
        value={preview ? undefined : "deny"}
        className="rounded-lg border border-[var(--border-strong)] px-5 py-3 text-sm font-medium text-[var(--fg-secondary)] transition hover:border-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
      >
        Deny
      </button>
      <button
        type={preview ? "button" : "submit"}
        name={preview ? undefined : "decision"}
        value={preview ? undefined : "approve"}
        className="rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-on)] transition hover:bg-[var(--accent-hover)]"
      >
        Allow access
      </button>
    </>
  );
}

export function Approve({
  authorizationId,
  clientName,
  scopes,
  returnLabel = "You will be returned to the requesting application after choosing an option.",
  preview = false,
}: ApproveProps) {
  const requestedScopes = new Set(scopes);
  const permissionGroups = MCP_PERMISSION_GROUPS.map((group) => ({
    ...group,
    permissions: group.permissions.filter((permission) => requestedScopes.has(permission.scope)),
  })).filter((group) => group.permissions.length > 0);
  const knownScopes = new Set(
    MCP_PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.scope)),
  );
  const otherScopes = scopes.filter((scope) => !knownScopes.has(scope));
  const actions = (
    <div className="mt-0 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <DecisionButtons preview={preview} />
    </div>
  );

  return (
    <main className="min-h-screen bg-[var(--bg-site)] px-6 py-4 text-[var(--fg-primary)] sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] w-full max-w-[500px] items-center">
        <div className="w-full">
        <div className="mb-6 flex items-center gap-3 text-sm font-semibold tracking-[0.12em] text-[var(--fg-primary)]">
          <Image
            src="/neonix-logo.svg"
            alt="Neonix"
            width={38}
            height={28}
            className="h-7 w-[38px] object-contain"
          />
          NEONIX
        </div>

        <section className="flex max-h-[800px] min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-7 shadow-2xl shadow-black/20 sm:p-9">
          <div className="shrink-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">
            Authorization request
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Connect {clientName} to Neonix?
            </h1>
            <p className="mt-4 leading-7 text-[var(--fg-secondary)]">
            This application is requesting access to act on your behalf in
            your current Neonix workspace. You can revoke access later from
            your account settings.
            </p>

            <p className="py-3 text-sm text-[var(--fg-muted)]">Requested permissions</p>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {permissionGroups.map((group) => (
              <section
                key={group.id}
                className="py-3 first:pt-0"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-[var(--fg-primary)]">{group.label}</h2>
                    <p className="mt-1 text-sm leading-5 text-[var(--fg-muted)]">{group.description}</p>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--fg-muted)]">
                    {group.permissions.length} {group.permissions.length === 1 ? "permission" : "permissions"}
                  </span>
                </div>
                <ul className="mt-4 space-y-3">
                  {group.permissions.map((permission) => (
                    <li key={permission.scope} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[10px] font-bold text-[var(--accent-text)]">
                        ✓
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[var(--fg-primary)]">
                          {permission.label}
                          {permission.destructive ? <span className="ml-2 text-xs font-normal text-[var(--fg-muted)]">Destructive</span> : null}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {otherScopes.length > 0 ? (
              <div className="py-3">
                <p className="text-sm font-semibold text-[var(--fg-primary)]">Other permissions</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {otherScopes.map((scope) => (
                    <span key={scope} title={scope} className="px-2.5 py-1 text-xs text-[var(--fg-secondary)]">
                      {scope}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {permissionGroups.length === 0 && otherScopes.length === 0 ? (
              <div className="py-3 text-sm text-[var(--fg-muted)]">
                Basic access
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-[var(--border-subtle)] pt-4">
            {preview ? (
              actions
            ) : (
              <form action="/api/oauth/decision" method="post">
                <input type="hidden" name="authorization_id" value={authorizationId} />
                {actions}
              </form>
            )}

            <p className="mt-4 text-center text-xs leading-5 text-[var(--fg-muted)]">
              {returnLabel}
            </p>
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}
