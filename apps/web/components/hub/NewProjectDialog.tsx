"use client";

import { Check, ChevronDown, LoaderCircle, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Dropdown } from "@/components/ui/Dropdown/Dropdown";
import { NumberInput } from "@/components/ui/NumberInput/NumberInput";
import { createBlankProject } from "@/lib/api/projects";
import { appUrl } from "@/lib/hosts";

const ASPECT_RATIO_PRESETS = [
  { id: "vertical", width: 1080, height: 1920 },
  { id: "square", width: 1080, height: 1080 },
  { id: "horizontal", width: 1920, height: 1080 },
] as const;

const FPS_OPTIONS = [24, 30, 60] as const;

type AspectRatioPresetId = (typeof ASPECT_RATIO_PRESETS)[number]["id"] | "custom";

export function NewProjectDialog() {
  const t = useTranslations("NewProjectDialog");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioPresetId>("vertical");
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1920);
  const [fps, setFps] = useState(30);
  const [background, setBackground] = useState("#000000");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (submitting) return;
    setOpen(false);
    setError(null);
  }

  async function submit() {
    if (aspectRatio === "custom" && (!Number.isFinite(customWidth) || customWidth <= 0 || !Number.isFinite(customHeight) || customHeight <= 0)) {
      setError(t("errorInvalidDimensions"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const preset = ASPECT_RATIO_PRESETS.find((item) => item.id === aspectRatio);
      const width = preset ? preset.width : customWidth;
      const height = preset ? preset.height : customHeight;
      const { projectId } = await createBlankProject({
        title: title.trim() || undefined,
        composition: { width, height, fps, background },
      });
      window.location.assign(appUrl(`/editor/${projectId}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("errorFallback"));
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(null); }}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--hub-accent)] px-4 py-2.5 text-body font-semibold text-[var(--hub-accent-on)] transition hover:bg-[var(--hub-accent-hover)]"
      >
        <Plus className="size-4" />
        {t("trigger")}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 px-5" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            className="w-full max-w-lg rounded-2xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.2)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-caption font-semibold tracking-[0.16em] text-[var(--hub-accent)] uppercase">{t("eyebrow")}</p>
                <h2 id="new-project-title" className="text-2xl font-semibold tracking-[-0.03em] text-[var(--fg-primary)]">{t("trigger")}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--fg-muted)]">{t("description")}</p>
              </div>
              <button type="button" aria-label={t("closeAria")} onClick={close} className="rounded-lg p-2 text-[var(--fg-muted)] hover:bg-[var(--hub-hover)] hover:text-[var(--fg-primary)]">
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[var(--fg-primary)]">{t("projectName")} <span className="font-normal text-[var(--fg-muted)]">{t("optional")}</span></span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("projectNamePlaceholder")} className="w-full rounded-lg border border-[var(--hub-border)] bg-transparent px-3 py-2.5 text-sm text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-disabled)] focus:border-[var(--hub-accent)]" />
              </label>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-[var(--fg-primary)]">{t("aspectRatio")}</span>
                <div className="grid grid-cols-4 gap-2">
                  {ASPECT_RATIO_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setAspectRatio(preset.id)}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${aspectRatio === preset.id ? "border-[var(--hub-accent)] bg-[var(--hub-accent)]/10 text-[var(--fg-primary)]" : "border-[var(--hub-border)] text-[var(--fg-muted)] hover:bg-[var(--hub-hover)]"}`}
                    >
                      {t(`aspectRatioPresets.${preset.id}`)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAspectRatio("custom")}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${aspectRatio === "custom" ? "border-[var(--hub-accent)] bg-[var(--hub-accent)]/10 text-[var(--fg-primary)]" : "border-[var(--hub-border)] text-[var(--fg-muted)] hover:bg-[var(--hub-hover)]"}`}
                  >
                    {t("aspectRatioPresets.custom")}
                  </button>
                </div>
                {aspectRatio === "custom" ? (
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-[var(--fg-primary)]">{t("width")}</span>
                      <NumberInput min={1} max={8192} value={customWidth} onChange={setCustomWidth} className="w-full" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-[var(--fg-primary)]">{t("height")}</span>
                      <NumberInput min={1} max={8192} value={customHeight} onChange={setCustomHeight} className="w-full" />
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="mb-1.5 block text-sm font-medium text-[var(--fg-primary)]">{t("fps")}</span>
                  <Dropdown
                    align="start"
                    label={t("fps")}
                    menuClassName="z-[70] min-w-[var(--radix-dropdown-menu-trigger-width)]"
                    trigger={
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg border border-[var(--hub-border)] bg-transparent px-3 py-2.5 text-sm text-[var(--fg-primary)] outline-none focus:border-[var(--hub-accent)]"
                      >
                        {fps}
                        <ChevronDown className="size-4 text-[var(--fg-muted)]" />
                      </button>
                    }
                    items={FPS_OPTIONS.map((option) => ({
                      label: String(option),
                      trailingIcon: option === fps ? <Check className="size-4" /> : undefined,
                      onSelect: () => setFps(option),
                    }))}
                  />
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-[var(--fg-primary)]">{t("background")}</span>
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--hub-border)] px-3 py-1.5">
                    <input type="color" value={background} onChange={(event) => setBackground(event.target.value)} className="size-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" />
                    <input value={background} onChange={(event) => setBackground(event.target.value)} className="w-full bg-transparent text-sm text-[var(--fg-primary)] outline-none" />
                  </div>
                </label>
              </div>
            </div>

            {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700">{error}</p> : null}

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={submitting} onClick={close} className="rounded-lg border border-[var(--hub-border)] px-4 py-2.5 text-sm font-medium text-[var(--fg-primary)] hover:bg-[var(--hub-hover)] disabled:opacity-60">{t("cancel")}</button>
              <button type="button" disabled={submitting} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-lg bg-[var(--hub-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--hub-accent-on)] hover:bg-[var(--hub-accent-hover)] disabled:opacity-60">
                {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {submitting ? t("creating") : t("trigger")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
