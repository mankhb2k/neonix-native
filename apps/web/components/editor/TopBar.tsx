"use client";

import { AppLink } from "@/components/AppLink";
import { useEditorStore } from "@/lib/store/editor-store";
import { marketingUrl } from "@/lib/hosts";

export function TopBar() {
  const project = useEditorStore((s) => s.project);
  const isExporting = useEditorStore((s) => s.isExporting);
  const setExporting = useEditorStore((s) => s.setExporting);

  return (
    <header className="mv-topbar">
      <AppLink href="/" className="mv-topbar-brand">
        MotionVideo
      </AppLink>
      <div className="mv-topbar-meta">
        <span className="mv-topbar-title">
          {project?.brand.name ?? "Chưa có dự án"}
        </span>
        {project ? (
          <>
            <span className="mv-pill">{project.aspectRatio}</span>
            <span className="mv-pill">{project.scenes.length} scene</span>
            {project.industry ? (
              <span className="mv-pill">{project.industry}</span>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="mv-topbar-actions">
        <a className="mv-btn mv-btn-ghost mv-btn-sm" href={marketingUrl("/")}>
          Landing
        </a>
        <AppLink href="/projects/new" className="mv-btn mv-btn-ghost mv-btn-sm">
          Dự án mới
        </AppLink>
        <button
          type="button"
          className="mv-btn mv-btn-primary mv-btn-sm"
          disabled={!project || isExporting}
          onClick={() => {
            setExporting(true);
            window.setTimeout(() => setExporting(false), 1200);
          }}
        >
          {isExporting ? "Đang xếp hàng…" : "Xuất video"}
        </button>
      </div>
    </header>
  );
}
