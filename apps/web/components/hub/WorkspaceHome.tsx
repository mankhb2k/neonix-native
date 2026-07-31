"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppLink, appHref } from "@/components/AppLink";
import { DesktopHub, DesktopTitleStrip } from "@/components/desktop/hub";
import { useIsDesktop } from "@/lib/desktop";
import { NewProjectModal } from "@/components/hub/NewProjectModal";
import { ProjectList } from "@/components/hub/ProjectList";
import { createBlankProject } from "@/lib/editor/create-blank-project";
import { saveProject } from "@/lib/editor/project-storage";
import { marketingUrl } from "@/lib/hosts";
import { Plus, Smartphone, Tv, Square } from "lucide-react";

export function WorkspaceHome() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [modalOpen, setModalOpen] = useState(false);

  if (isDesktop) {
    return <DesktopHub />;
  }



  function handleQuickCreate(aspectRatio: "9:16" | "16:9" | "1:1", defaultName: string) {
    const project = createBlankProject({
      name: defaultName,
      aspectRatio,
    });
    saveProject(project);
    router.push(appHref(`/editor/${project.metadata.id}`));
  }

  return (
    <div className="mv-hub">
      <DesktopTitleStrip />
      <header className="mv-hub-header">
        <AppLink href="/" className="mv-hub-brand">
          MotionVideo
        </AppLink>
        <nav className="mv-hub-nav">
          <button
            type="button"
            className="mv-link-btn"
            onClick={() => setModalOpen(true)}
          >
            Tạo TVC
          </button>
          <a href={marketingUrl("/")}>Landing</a>
        </nav>
      </header>
      <main className="mv-hub-main">
        <p className="mv-hub-kicker">Workspace</p>
        <h1 className="mv-hub-title">Tạo TVC motion 2D tiếng Việt</h1>
        <p className="mv-hub-lead">
          Đặt tên và chọn tỉ lệ — kéo khung hình vào timeline để bắt đầu.
        </p>

        <div className="flex flex-wrap items-center gap-3 my-6">
          <button
            type="button"
            className="mv-btn mv-btn-primary flex items-center gap-2"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={16} strokeWidth={2} />
            <span>Tạo dự án mới</span>
          </button>

          <div className="flex items-center gap-2 pl-2 border-l border-[var(--line-strong)]">
            <button
              type="button"
              onClick={() => handleQuickCreate("9:16", "TikTok Shorts 9:16")}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--bg-panel)] px-3 py-2 text-xs font-medium text-[var(--fg-muted)] hover:border-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
              title="Tạo nhanh dự án dạng dọc"
            >
              <Smartphone size={14} />
              <span>Dọc 9:16</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickCreate("16:9", "YouTube Motion 16:9")}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--bg-panel)] px-3 py-2 text-xs font-medium text-[var(--fg-muted)] hover:border-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
              title="Tạo nhanh dự án dạng ngang"
            >
              <Tv size={14} />
              <span>Ngang 16:9</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickCreate("1:1", "Feed Square 1:1")}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--bg-panel)] px-3 py-2 text-xs font-medium text-[var(--fg-muted)] hover:border-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
              title="Tạo nhanh dự án dạng vuông"
            >
              <Square size={14} />
              <span>Vuông 1:1</span>
            </button>
          </div>
        </div>

        <ProjectList onNewProject={() => setModalOpen(true)} />
      </main>
      <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

