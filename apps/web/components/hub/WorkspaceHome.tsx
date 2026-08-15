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

const hubBg =
  "[background:radial-gradient(ellipse_70%_45%_at_12%_-8%,rgba(13,148,136,0.1)_0%,transparent_55%),radial-gradient(ellipse_55%_40%_at_92%_8%,rgba(2,132,199,0.08)_0%,transparent_50%),var(--bg-site)]";

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
    <div className={`min-h-screen text-[var(--fg-primary)] ${hubBg}`}>
      <DesktopTitleStrip />
      <header className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-3.5 shadow-sm backdrop-blur-[10px] [background:color-mix(in_srgb,var(--bg-editor)_88%,transparent)]">
        <AppLink
          href="/"
          className="font-semibold tracking-[-0.02em] text-[var(--fg-primary)] no-underline text-[1.2rem] [font-family:var(--font-display)]"
        >
          MotiClip
        </AppLink>
        <nav className="flex items-center gap-4">
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent font-[inherit] text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
            onClick={() => setModalOpen(true)}
          >
            Tạo TVC
          </button>
          <a
            href={marketingUrl("/")}
            className="text-[var(--fg-muted)] no-underline hover:text-[var(--fg-primary)]"
          >
            Landing
          </a>
        </nav>
      </header>
      <main className="mx-auto max-w-[920px] px-6 pt-11 pb-16">
        <p className="mb-2 text-caption font-semibold tracking-[0.08em] text-[var(--accent-text)] uppercase">
          Workspace
        </p>
        <h1 className="mb-3 font-semibold tracking-[-0.03em] text-[var(--fg-primary)] [font-family:var(--font-display)] [font-size:clamp(1.85rem,4vw,2.55rem)] [line-height:1.12]">
          Tạo TVC motion 2D tiếng Việt
        </h1>
        <p className="m-0 max-w-[36rem] text-[1.05rem] leading-[1.65] text-[var(--fg-muted)]">
          Brief hoặc kịch bản → AI Studio editor. Chỉnh từng element trên stage,
          không cần After Effects.
        </p>

        <div className="my-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full border border-transparent bg-[var(--accent)] px-4 font-semibold text-[var(--accent-on)] shadow-[0_6px_18px_rgba(13,148,136,0.28)] transition hover:-translate-y-px hover:bg-[var(--accent-hover)] hover:shadow-[0_8px_22px_rgba(13,148,136,0.34)]"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={16} strokeWidth={2} />
            <span>Tạo dự án mới</span>
          </button>

          <button
            type="button"
            data-testid="demo-facebook-history"
            onClick={handleFacebookHistoryDemo}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-editor)] px-3.5 py-2 text-xs font-medium text-[var(--fg-muted)] shadow-sm transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)]"
            title="Mở demo Remotion: lịch sử Facebook"
          >
            <Clapperboard size={14} />
            <span>Demo Facebook History</span>
          </button>

          <div className="flex items-center gap-2 border-l border-[var(--border-strong)] pl-2">
            <button
              type="button"
              onClick={() => handleQuickCreate("9:16", "TikTok Shorts 9:16")}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-editor)] px-3.5 py-2 text-xs font-medium text-[var(--fg-muted)] shadow-sm transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)]"
              title="Tạo nhanh dự án dạng dọc"
            >
              <Smartphone size={14} />
              <span>Dọc 9:16</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickCreate("16:9", "YouTube Motion 16:9")}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-editor)] px-3.5 py-2 text-xs font-medium text-[var(--fg-muted)] shadow-sm transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)]"
              title="Tạo nhanh dự án dạng ngang"
            >
              <Tv size={14} />
              <span>Ngang 16:9</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickCreate("1:1", "Feed Square 1:1")}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-editor)] px-3.5 py-2 text-xs font-medium text-[var(--fg-muted)] shadow-sm transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)]"
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
