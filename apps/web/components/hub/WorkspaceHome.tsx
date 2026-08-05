"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppLink, appHref } from "@/components/AppLink";
import { DesktopTitleStrip } from "@/components/hub/DesktopTitleStrip";
import { NewProjectModal } from "@/components/hub/NewProjectModal";
import { ProjectList } from "@/components/hub/ProjectList";
import { createBlankProject } from "@/lib/editor/create-blank-project";
import { seedWebEditorUi } from "@/lib/editor/fixtures/seed-editor-ui";
import { saveProject } from "@/lib/editor/project-storage";
import { marketingUrl } from "@/lib/hosts";
import { Clapperboard, Plus, Smartphone, Tv, Square } from "lucide-react";

export function WorkspaceHome() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  function handleQuickCreate(
    aspectRatio: "9:16" | "16:9" | "1:1",
    defaultName: string,
  ) {
    const project = createBlankProject({
      name: defaultName,
      aspectRatio,
    });
    saveProject(project);
    router.push(appHref(`/editor/${project.metadata.id}`));
  }

  function handleFacebookHistoryDemo() {
    const seed = seedWebEditorUi("facebook-history");
    saveProject(seed.snapshot.project, {
      timelineClips: seed.snapshot.timelineClips,
      timelineLanes: seed.snapshot.timelineLanes,
      overlayScenes: seed.snapshot.overlayScenes,
    });
    router.push(appHref(`/editor/${seed.projectId}`));
  }

  return (
    <div className="mv-hub">
      <DesktopTitleStrip />
      <header className="mv-hub-header">
        <AppLink href="/" className="mv-hub-brand">
          MotiClip
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
          Brief hoặc kịch bản → AI Studio editor. Chỉnh từng element trên stage,
          không cần After Effects.
        </p>

        <div className="my-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="mv-btn mv-btn-primary flex items-center gap-2"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={16} strokeWidth={2} />
            <span>Tạo dự án mới</span>
          </button>

          <button
            type="button"
            data-testid="demo-facebook-history"
            onClick={handleFacebookHistoryDemo}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3.5 py-2 text-xs font-medium text-[var(--fg-muted)] shadow-[var(--shadow-sm)] transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)]"
            title="Mở demo Remotion: lịch sử Facebook"
          >
            <Clapperboard size={14} />
            <span>Demo Facebook History</span>
          </button>

          <div className="flex items-center gap-2 border-l border-[var(--line-strong)] pl-2">
            <button
              type="button"
              onClick={() => handleQuickCreate("9:16", "TikTok Shorts 9:16")}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3.5 py-2 text-xs font-medium text-[var(--fg-muted)] shadow-[var(--shadow-sm)] transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)]"
              title="Tạo nhanh dự án dạng dọc"
            >
              <Smartphone size={14} />
              <span>Dọc 9:16</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickCreate("16:9", "YouTube Motion 16:9")}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3.5 py-2 text-xs font-medium text-[var(--fg-muted)] shadow-[var(--shadow-sm)] transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)]"
              title="Tạo nhanh dự án dạng ngang"
            >
              <Tv size={14} />
              <span>Ngang 16:9</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickCreate("1:1", "Feed Square 1:1")}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3.5 py-2 text-xs font-medium text-[var(--fg-muted)] shadow-[var(--shadow-sm)] transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)]"
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
