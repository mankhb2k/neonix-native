"use client";

import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createApiKey, listApiKeys, revokeApiKey, type ApiKey, type CreatedApiKey } from "@/lib/api/api-keys";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

export function ApiWorkspace() {
  const t = useTranslations("ApiWorkspace");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<CreatedApiKey | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  async function loadKeys() {
    try {
      setKeys(await listApiKeys());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("apiErrors.load"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadKeys();
  }, []);

  async function handleCreate() {
    setBusy(true);
    setMessage("");
    try {
      const created = await createApiKey(name);
      setNewKey(created);
      setName("");
      await loadKeys();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("apiErrors.create"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm(t("apiRevokeConfirm"))) return;
    setBusy(true);
    setMessage("");
    try {
      await revokeApiKey(id);
      setKeys((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("apiErrors.revoke"));
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey.token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="mb-2 text-caption font-semibold tracking-[0.16em] text-[var(--hub-accent)] uppercase">{t("apiEyebrow")}</p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)] sm:text-4xl">{t("apiTitle")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--fg-muted)]">{t("apiDescription")}</p>
      </header>

      <section className="rounded-2xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--hub-accent)]"><KeyRound className="size-5" /></div>
          <div><h2 className="text-lg font-semibold text-[var(--fg-primary)]">{t("apiCreateTitle")}</h2><p className="mt-1 text-sm text-[var(--fg-muted)]">{t("apiCreateDescription")}</p></div>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("apiNamePlaceholder")} maxLength={80} className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--hub-border)] bg-[var(--hub-content-bg)] px-3 text-sm text-[var(--fg-primary)] outline-none focus:border-[var(--hub-accent)]" />
          <button type="button" onClick={() => void handleCreate()} disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--hub-accent)] px-5 text-sm font-semibold text-[var(--hub-accent-on)] transition hover:bg-[var(--hub-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"><Plus className="size-4" />{t("apiCreateButton")}</button>
        </div>
        {newKey ? (
          <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-[var(--fg-primary)]">{t("apiCopyTitle")}</p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">{t("apiCopyDescription")}</p>
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-black/20 px-3 py-2 text-xs text-[var(--fg-primary)]">{newKey.token}</code>
              <button type="button" onClick={() => void copyKey()} aria-label={t("apiCopyButton")} className="rounded-lg border border-[var(--hub-border)] p-2 text-[var(--fg-muted)] hover:text-[var(--fg-primary)]">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</button>
            </div>
          </div>
        ) : null}
        {message ? <p aria-live="polite" className="mt-3 text-sm text-red-600">{message}</p> : null}
      </section>

      <section className="rounded-2xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] shadow-sm">
        <div className="border-b border-[var(--hub-border)] px-6 py-5 sm:px-8"><h2 className="text-lg font-semibold text-[var(--fg-primary)]">{t("apiListTitle")}</h2></div>
        {loading ? <p className="px-6 py-8 text-sm text-[var(--fg-muted)] sm:px-8">{t("apiLoading")}</p> : keys.length === 0 ? <p className="px-6 py-8 text-sm text-[var(--fg-muted)] sm:px-8">{t("apiEmpty")}</p> : <div className="divide-y divide-[var(--hub-border)]">{keys.map((item) => <div key={item.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:px-8"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--fg-primary)]">{item.name}</p><p className="mt-1 font-mono text-xs text-[var(--fg-muted)]">{item.prefix}•••••••• · {t("apiCreated", { date: formatDate(item.createdAt) })}</p></div><button type="button" onClick={() => void handleRevoke(item.id)} disabled={busy} className="inline-flex items-center gap-2 self-start rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-60 sm:self-auto"><Trash2 className="size-4" />{t("apiRevoke")}</button></div>)}</div>}
      </section>
    </div>
  );
}
