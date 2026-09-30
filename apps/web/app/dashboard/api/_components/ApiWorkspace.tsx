"use client";

import { Copy, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { createApiKey, listApiKeys, renameApiKey, revokeApiKey, type ApiKey, type CreatedApiKey } from "@/lib/api/api-keys";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)).replaceAll("/", "-");
}

function Modal({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-3xl bg-[var(--hub-card-bg)] p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-[var(--fg-primary)]">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={closeLabel}><X className="size-5" /></Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ApiWorkspace() {
  const t = useTranslations("ApiWorkspace");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<CreatedApiKey | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [renameTarget, setRenameTarget] = useState<ApiKey | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  async function loadKeys() {
    try {
      setKeys(await listApiKeys());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("apiErrors.load"));
    }
  }

  useEffect(() => {
    void loadKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (createOpen) nameInputRef.current?.focus();
  }, [createOpen]);

  useEffect(() => {
    if (renameTarget) renameInputRef.current?.select();
  }, [renameTarget]);

  function openRename(item: ApiKey) {
    setRenameValue(item.name);
    setModalMessage("");
    setRenameTarget(item);
  }

  async function handleRename() {
    if (busy || !renameTarget) return;
    setBusy(true);
    setModalMessage("");
    try {
      const updated = await renameApiKey(renameTarget.id, renameValue.trim());
      setKeys((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setRenameTarget(null);
    } catch (error) {
      setModalMessage(error instanceof Error ? error.message : t("apiErrors.rename"));
    } finally {
      setBusy(false);
    }
  }

  function openCreate() {
    setName("");
    setModalMessage("");
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (busy) return;
    setBusy(true);
    setModalMessage("");
    try {
      const created = await createApiKey(name.trim());
      setCreateOpen(false);
      setNewKey(created);
      setCopied(false);
      await loadKeys();
    } catch (error) {
      setModalMessage(error instanceof Error ? error.message : t("apiErrors.create"));
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
      <header className="flex flex-col">
        <div>
          <p className="mb-2 text-caption font-semibold tracking-[0.16em] text-[var(--hub-accent)] uppercase">{t("apiEyebrow")}</p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)] sm:text-4xl">{t("apiTitle")}</h1>
          <p className="mt-3 max-w-2xl text-base leading-6 text-[var(--fg-muted)]">{t("apiDescription")}</p>
        </div>
        <Button variant="primary" size="lg" onClick={openCreate} className="mt-6 h-11 gap-2 self-end rounded-full px-5 text-base font-semibold"><Plus className="size-4" />{t("apiCreateButton")}</Button>
      </header>

      {message ? <p aria-live="polite" className="text-base text-red-600">{message}</p> : null}

      {keys.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl bg-[var(--hub-card-bg)] px-4 py-2 sm:px-6">
          <table className="w-full min-w-[720px] border-collapse text-left text-base">
            <thead>
              <tr className="border-b border-[var(--hub-border)] text-[var(--fg-muted)]">
                <th className="py-4 pr-4 font-medium">{t("apiColName")}</th>
                <th className="py-4 pr-4 font-medium">{t("apiColTrackingId")}</th>
                <th className="py-4 pr-4 font-medium">{t("apiColKey")}</th>
                <th className="py-4 pr-4 font-medium">{t("apiColCreated")}</th>
                <th className="py-4 pr-4 font-medium">{t("apiColLastUsed")}</th>
                <th className="w-10 py-4" />
              </tr>
            </thead>
            <tbody className="text-[var(--fg-primary)]">
              {keys.map((item) => (
                <tr key={item.id}>
                  <td className="max-w-[160px] py-4 pr-4 break-words">{item.name}</td>
                  <td className="py-4 pr-4 font-mono text-base">{item.id}</td>
                  <td className="py-4 pr-4 font-mono text-base whitespace-nowrap">{item.prefix}*****</td>
                  <td className="py-4 pr-4 whitespace-nowrap">{formatDate(item.createdAt)}</td>
                  <td className="py-4 pr-4 whitespace-nowrap">{item.lastUsedAt ? formatDate(item.lastUsedAt) : t("apiNever")}</td>
                  <td className="py-4 text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" onClick={() => openRename(item)} aria-label={t("apiEdit")} title={t("apiEdit")}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => void handleRevoke(item.id)} disabled={busy} aria-label={t("apiRevoke")} title={t("apiRevoke")} className="hover:text-[var(--danger)]"><Trash2 className="size-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {createOpen ? (
        <Modal title={t("apiModalTitle")} closeLabel={t("apiModalClose")} onClose={() => setCreateOpen(false)}>
          <form onSubmit={(event) => { event.preventDefault(); void handleCreate(); }}>
            <p className="mt-3 text-base text-[var(--fg-muted)]">{t("apiModalDescription")}</p>
            <input ref={nameInputRef} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} aria-label={t("apiModalNameLabel")} placeholder={t("apiModalNamePlaceholder")} className="mt-4 h-11 w-full rounded-full border border-[var(--hub-border)] bg-[var(--hub-content-bg)] px-4 text-base text-[var(--fg-primary)] outline-none focus:border-[var(--fg-primary)]" />
            {modalMessage ? <p aria-live="polite" className="mt-3 text-base text-red-600">{modalMessage}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="lg" onClick={() => setCreateOpen(false)} className="rounded-full px-4 text-base">{t("apiModalCancel")}</Button>
              <Button type="submit" variant="primary" size="lg" disabled={busy || name.trim().length === 0} className="rounded-full px-4 text-base font-semibold">{busy ? t("apiModalCreating") : t("apiModalSubmit")}</Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {renameTarget ? (
        <Modal title={t("apiRenameTitle")} closeLabel={t("apiModalClose")} onClose={() => setRenameTarget(null)}>
          <form onSubmit={(event) => { event.preventDefault(); void handleRename(); }}>
            <input ref={renameInputRef} autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} maxLength={80} aria-label={t("apiModalNameLabel")} placeholder={t("apiModalNamePlaceholder")} className="mt-4 h-11 w-full rounded-full border border-[var(--hub-border)] bg-[var(--hub-content-bg)] px-4 text-base text-[var(--fg-primary)] outline-none focus:border-[var(--fg-primary)]" />
            {modalMessage ? <p aria-live="polite" className="mt-3 text-base text-red-600">{modalMessage}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="lg" onClick={() => setRenameTarget(null)} className="rounded-full px-4 text-base">{t("apiModalCancel")}</Button>
              <Button type="submit" variant="primary" size="lg" disabled={busy || renameValue.trim().length === 0 || renameValue.trim() === renameTarget.name} className="rounded-full px-4 text-base font-semibold">{t("apiRenameSubmit")}</Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {newKey ? (
        <Modal title={t("apiModalTitle")} closeLabel={t("apiModalClose")} onClose={() => setNewKey(null)}>
          <p className="mt-3 text-base leading-6 text-[var(--fg-muted)]">{t("apiSaveNotice")}</p>
          <div className="mt-4 flex items-center gap-2 rounded-full bg-[var(--hub-content-bg)] py-1.5 pr-1.5 pl-4">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-base text-[var(--fg-primary)]">{newKey.token}</code>
            <Button variant="primary" onClick={() => void copyKey()} className="h-9 shrink-0 gap-2 rounded-full bg-[var(--fg-primary)] px-4 text-base font-semibold text-[var(--hub-card-bg)] hover:bg-[var(--fg-primary)] hover:opacity-90">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? t("apiCopied") : t("apiCopy")}</Button>
          </div>
          <p className="mt-4 text-base leading-6 text-[var(--fg-primary)]">{t("apiShareNotice")}</p>
        </Modal>
      ) : null}
    </div>
  );
}
