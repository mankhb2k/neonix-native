"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { appHref } from "@/components/AppLink";
import { saveProject } from "@/lib/project-storage";
import { planMotionProject } from "@motionvideo/ai-planner";

type AspectRatio = "9:16" | "16:9" | "1:1";

type Props = {
  open: boolean;
  onClose: () => void;
};

const RATIOS: Array<{ value: AspectRatio; label: string; hint: string }> = [
  { value: "9:16", label: "9:16", hint: "TikTok, Reels, Shorts" },
  { value: "16:9", label: "16:9", hint: "YouTube, ngang" },
  { value: "1:1", label: "1:1", hint: "Feed vuông" },
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
      const project = planMotionProject({
        brandName: trimmed,
        industry: "fnb",
        aspectRatio: ratio,
        script: "Hook của bạn\nƯu đãi nổi bật\nKêu gọi hành động",
      });
      saveProject(project);
      onClose();
      router.push(appHref(`/editor/${project.id}`));
    } catch {
      setBusy(false);
    }
  }

  return (
    <div
      className="mv-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="mv-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="mv-modal-head">
          <h2 id={titleId}>Tạo dự án mới</h2>
          <button
            type="button"
            className="mv-modal-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
        <form className="mv-modal-body" onSubmit={submit}>
          <div className="mv-field">
            <label htmlFor="project-name">Tên dự án</label>
            <input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
              maxLength={80}
            />
          </div>
          <div className="mv-field">
            <span className="mv-field-label">Tỉ lệ khung hình</span>
            <div className="mv-ratio-grid" role="radiogroup" aria-label="Tỉ lệ">
              {RATIOS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={ratio === item.value}
                  className={`mv-ratio-card${ratio === item.value ? " is-active" : ""}`}
                  onClick={() => setRatio(item.value)}
                >
                  <span
                    className="mv-ratio-shape"
                    data-ratio={item.value}
                    aria-hidden
                  />
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mv-modal-actions">
            <button
              type="button"
              className="mv-btn mv-btn-ghost"
              onClick={onClose}
              disabled={busy}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="mv-btn mv-btn-primary"
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
