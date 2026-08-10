"use client";

import { useEffect, useState } from "react";
import { AppLink } from "@/components/AppLink";
import { listProjects, type StoredProject } from "@/lib/editor/project-storage";
import { compositionAspectRatio } from "@/lib/runtime/project-composition";
import { Plus } from "lucide-react";

type Props = {
  onNewProject?: () => void;
};

const cardClass =
  "block rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-[1.15rem] py-[1.1rem] text-inherit no-underline shadow-sm transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border-subtle))] hover:shadow-md";

export function ProjectList({ onNewProject }: Props) {
  const [items, setItems] = useState<StoredProject[]>([]);

  useEffect(() => {
    setItems(listProjects());
  }, []);

  if (items.length === 0) {
    return (
      <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        <button
          type="button"
          onClick={onNewProject}
          className={`${cardClass} group flex cursor-pointer flex-col items-start justify-between text-left`}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-on)]">
              <Plus size={16} strokeWidth={2} />
            </span>
            <h3 className="m-0 text-base font-semibold text-[var(--fg-primary)]">
              Tạo dự án đầu tiên
            </h3>
          </div>
          <p className="mt-2 text-xs text-[var(--fg-muted)]">
            Tạo TVC motion 2D từ template tiếng Việt (9:16, 16:9, 1:1) để bắt đầu
            biên tập ngay.
          </p>
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
      {items.map(({ project, savedAt }) => (
        <AppLink
          key={project.metadata.id}
          href={`/editor/${project.metadata.id}`}
          className={cardClass}
        >
          <h3 className="mb-1.5 text-[0.95rem] font-semibold text-[var(--fg-primary)]">
            {project.metadata.name}
          </h3>
          <p className="m-0 text-[0.8rem] leading-[1.45] text-[var(--fg-muted)]">
            {compositionAspectRatio(project)} · {project.scenes.length} scene
          </p>
          <p className="mt-2 text-[0.8rem] text-[var(--fg-muted)]">
            {new Date(savedAt).toLocaleString("vi-VN")}
          </p>
        </AppLink>
      ))}
    </div>
  );
}
