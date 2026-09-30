"use client";

import { FileCode2, LoaderCircle, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import { createHtmlProjectRaw } from "@/lib/api/projects";
import { previewUrl } from "@/lib/hosts";

export function ImportHtmlDialog() {
  const t = useTranslations("ImportHtmlDialog");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function close() {
    if (submitting) return;
    setOpen(false);
    setError(null);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (!title.trim()) setTitle(file.name.replace(/\.(html?|HTML?)$/, ""));
    setHtml(await file.text());
    setError(null);
  }

  async function submit() {
    if (!html.trim()) {
      setError(t("errorMissingHtml"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { projectId } = await createHtmlProjectRaw({ title: title.trim() || undefined, html });
      window.open(previewUrl(`/preview/${projectId}`), "_blank", "noopener,noreferrer");
      setOpen(false);
      setTitle("");
      setHtml("");
      setFileName("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("errorFallback"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        onClick={() => { setOpen(true); setError(null); }}
        className="gap-2 bg-[var(--hub-card-bg)] px-4 text-body font-semibold"
      >
        <FileCode2 className="size-4" />
        {t("trigger")}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 px-5" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-html-title"
            className="max-h-[min(760px,calc(100vh-40px))] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.2)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-caption font-semibold tracking-[0.16em] text-[var(--hub-accent)] uppercase">{t("eyebrow")}</p>
                <h2 id="import-html-title" className="text-2xl font-semibold tracking-[-0.03em] text-[var(--fg-primary)]">{t("trigger")}</h2>
                <p className="mt-2 text-base leading-6 text-[var(--fg-muted)]">{t("description")}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label={t("closeAria")} onClick={close} className="size-9">
                <X className="size-5" />
              </Button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-base font-medium text-[var(--fg-primary)]">{t("projectName")} <span className="font-normal text-[var(--fg-muted)]">{t("optional")}</span></span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("projectNamePlaceholder")} className="w-full rounded-lg border border-[var(--hub-border)] bg-transparent px-3 py-2.5 text-base text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-disabled)] focus:border-[var(--hub-accent)]" />
              </label>

              <input ref={fileInputRef} type="file" accept=".html,.htm,text/html" onChange={(event) => void handleFileChange(event)} className="hidden" />
              <Button variant="outline" size="lg" onClick={() => fileInputRef.current?.click()} className="gap-2 border-dashed px-3 text-base">
                <Upload className="size-4" />
                {t("chooseFile")}
              </Button>
              {fileName ? <span className="ml-2 text-base text-[var(--fg-muted)]">{fileName}</span> : null}

              <label className="block">
                <span className="mb-1.5 block text-base font-medium text-[var(--fg-primary)]">{t("htmlDocument")}</span>
                <textarea value={html} onChange={(event) => setHtml(event.target.value)} rows={14} placeholder="<!doctype html>\n<html>\n  ...\n</html>" className="w-full resize-y rounded-lg border border-[var(--hub-border)] bg-transparent px-3 py-2.5 font-mono text-xs leading-5 text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-disabled)] focus:border-[var(--hub-accent)]" />
              </label>
            </div>

            {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-base leading-5 text-red-700">{error}</p> : null}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="lg" disabled={submitting} onClick={close} className="px-4 text-base">{t("cancel")}</Button>
              <Button variant="primary" size="lg" disabled={submitting} onClick={() => void submit()} className="gap-2 px-4 text-base font-semibold">
                {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <FileCode2 className="size-4" />}
                {submitting ? t("importing") : t("trigger")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
