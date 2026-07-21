"use client";

import { useState } from "react";
import { AppLink } from "@/components/AppLink";
import { NewProjectModal } from "@/components/hub/NewProjectModal";
import { useEditorStore } from "@/lib/store/editor-store";

export function TopBar() {
  const project = useEditorStore((s) => s.project);
  const isExporting = useEditorStore((s) => s.isExporting);
  const setExporting = useEditorStore((s) => s.setExporting);
  const updateBrand = useEditorStore((s) => s.updateBrand);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <header className="mv-topbar">
        <div className="mv-topbar-left">
          <AppLink href="/" className="mv-topbar-brand">
            MotionVideo
          </AppLink>
          <input
            className="mv-topbar-name"
            value={project?.brand.name ?? ""}
            onChange={(e) => updateBrand({ name: e.target.value })}
            aria-label="Tên dự án"
          />
          {project ? (
            <span className="mv-pill">{project.aspectRatio}</span>
          ) : null}
        </div>
        <div className="mv-topbar-center">
          <button type="button" className="mv-icon-btn" title="Hoàn tác" disabled>
            ↶
          </button>
          <button type="button" className="mv-icon-btn" title="Làm lại" disabled>
            ↷
          </button>
          <span className="mv-pill">100%</span>
        </div>
        <div className="mv-topbar-actions">
          <button
            type="button"
            className="mv-btn mv-btn-ghost mv-btn-sm"
            onClick={() => setModalOpen(true)}
          >
            Dự án mới
          </button>
          <button
            type="button"
            className="mv-btn mv-btn-primary mv-btn-sm"
            disabled={!project || isExporting}
            onClick={() => {
              setExporting(true);
              window.setTimeout(() => setExporting(false), 1200);
            }}
          >
            {isExporting ? "Đang xếp hàng…" : "Xuất"}
          </button>
        </div>
      </header>
      <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
