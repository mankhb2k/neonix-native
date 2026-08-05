"use client";

import { useEffect, useState } from "react";
import { AppLink } from "@/components/AppLink";
import { listProjects, type StoredProject } from "@/lib/editor/project-storage";
import { Plus } from "lucide-react";

type Props = {
  onNewProject?: () => void;
};

export function ProjectList({ onNewProject }: Props) {
  const [items, setItems] = useState<StoredProject[]>([]);

  useEffect(() => {
    setItems(listProjects());
  }, []);

  if (items.length === 0) {
    return (
      <div className="mv-card-grid">
        <button
          type="button"
          onClick={onNewProject}
          className="mv-card flex flex-col items-start justify-between cursor-pointer hover:border-[var(--line-strong)] text-left transition-all group"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-on)]">
              <Plus size={16} strokeWidth={2} />
            </span>
            <h3 className="text-base font-semibold text-[var(--fg-primary)]">Tạo dự án đầu tiên</h3>
          </div>
          <p className="text-xs text-[var(--fg-muted)] mt-2">
            Tạo TVC motion 2D từ template tiếng Việt (9:16, 16:9, 1:1) để bắt đầu biên tập ngay.
          </p>
        </button>
      </div>
    );
  }

  return (
    <div className="mv-card-grid">
      {items.map(({ project, savedAt }) => (
        <AppLink
          key={project.metadata.id}
          href={`/editor/${project.metadata.id}`}
          className="mv-card"
        >
          <h3>{project.metadata.brand.name}</h3>
          <p>
            {project.metadata.industry ?? "general"} · {project.metadata.aspectRatio} ·{" "}
            {project.scenes.length} scene
          </p>
          <p style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
            {new Date(savedAt).toLocaleString("vi-VN")}
          </p>
        </AppLink>
      ))}
    </div>
  );
}
