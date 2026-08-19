"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { appHref } from "@/components/AppLink";
import { createBlankProjectWithEnvelope } from "@/lib/editor/create-blank-project";
import { saveProject } from "@/lib/editor/project-storage";
import { cn } from "@/lib/utils";

type AspectRatio = "9:16" | "16:9" | "1:1";

type Props = {
  open: boolean;
  onClose: () => void;
};

const RATIOS: Array<{
  value: AspectRatio;
  label: string;
  hint: string;
  shapeClass: string;
}> = [
  {
    value: "9:16",
    label: "9:16",
    hint: "TikTok, Reels, Shorts",
    shapeClass: "h-7 w-4",
  },
  {
    value: "16:9",
    label: "16:9",
    hint: "YouTube, ngang",
    shapeClass: "h-4 w-7",
  },
  {
    value: "1:1",
    label: "1:1",
    hint: "Feed vuông",
    shapeClass: "h-[22px] w-[22px]",
  },
];

export function NewProjectModal({ open, onClose }: Props) {
  const router = useRouter();
  const titleId = useId();
  const [name, setName] = useState("Dự án chưa đặt tên");
  const [ratio, setRatio] = useState<AspectRatio>("9:16");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    setName("Dự án chưa đặt tên");
    setRatio("9:16");
    setBusy(false);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    try {
      const { project, envelope } = createBlankProjectWithEnvelope({
        name: trimmed,
        aspectRatio: ratio,
      });
      saveProject(project, { envelope });
      onClose();
      router.push(appHref(`/editor/${project.metadata.id}`));
    } catch {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,20,25,0.35)] p-5 backdrop-blur-[6px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-[min(440px,100%)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-editor)] shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-[1.15rem] py-4">
          <h2
            id={titleId}
            className="m-0 text-[1.05rem] font-semibold tracking-[-0.02em]"
          >
            Tạo dự án mới
          </h2>
          <button
            type="button"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--bg-surface)] text-[1.25rem] leading-none text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
        <form className="flex flex-col gap-[1.15rem] p-[1.15rem]" onSubmit={submit}>
          <div className="flex flex-col gap-[0.45rem]">
            <label
              htmlFor="project-name"
              className="text-[0.75rem] font-semibold tracking-[0.02em] text-[var(--fg-muted)]"
            >
              Tên dự án
            </label>
            <input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
              maxLength={80}
              className="h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 font-[inherit] text-[var(--fg-primary)] outline-none focus:border-[var(--border-focus)] focus:bg-[var(--bg-editor)] focus:shadow-[0_0_0_3px_var(--accent-soft)]"
            />
          </div>
          <div className="flex flex-col gap-[0.45rem]">
            <span className="text-[0.75rem] font-semibold tracking-[0.02em] text-[var(--fg-muted)]">
              Tỉ lệ khung hình
            </span>
            <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Tỉ lệ">
              {RATIOS.map((item) => {
                const active = ratio === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={cn(
                      "flex cursor-pointer flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)] shadow-[0_0_0_1px_var(--accent)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]",
                    )}
                    onClick={() => setRatio(item.value)}
                  >
                    <span
                      className={cn(
                        "block rounded border-[1.5px] border-current opacity-70",
                        item.shapeClass,
                      )}
                      aria-hidden
                    />
                    <strong
                      className={cn(
                        "text-[0.85rem]",
                        active ? "text-[var(--accent-text)]" : "text-[var(--fg-primary)]",
                      )}
                    >
                      {item.label}
                    </strong>
                    <span className="text-[0.7rem] leading-[1.3]">{item.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-1">
            <button
              type="button"
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-editor)] px-4 font-semibold text-[var(--fg-secondary)] shadow-sm transition hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onClose}
              disabled={busy}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-transparent bg-[var(--accent)] px-4 font-semibold text-[var(--accent-on)] shadow-[0_6px_18px_rgba(13,148,136,0.28)] transition hover:-translate-y-px hover:bg-[var(--accent-hover)] hover:shadow-[0_8px_22px_rgba(13,148,136,0.34)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy || !name.trim()}
            >
              {busy ? "Đang tạo…" : "Tạo & mở editor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
