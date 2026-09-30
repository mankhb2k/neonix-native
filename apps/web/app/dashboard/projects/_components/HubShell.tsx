import { FolderKanban } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui";
import { HubFrame } from "../../_components/HubFrame";
import { ImportHtmlDialog } from "./ImportHtmlDialog";
import { NewProjectDialog } from "./NewProjectDialog";
import { ProjectGrid, type ProjectCardData } from "./ProjectGrid";

const FREE_PROJECT_LIMIT = 10;

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function _LegacyProjectCard({ project }: { project: ProjectCardData }) {
  return (
    <a
      href={project.href}
      className="min-w-0 overflow-hidden rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] no-underline"
    >
      <div
        className={`relative aspect-video overflow-hidden bg-gradient-to-br ${project.accent}`}
      >
        <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(135deg,transparent_35%,rgba(255,255,255,0.08)_36%,transparent_37%),linear-gradient(45deg,transparent_48%,rgba(34,211,238,0.12)_49%,transparent_50%)] [background-size:32px_32px,48px_48px]" />
        <span className="absolute bottom-3 left-3 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-caption font-medium text-slate-200 backdrop-blur-sm">
          Neonix JSON V2
        </span>
        <span className="absolute right-3 bottom-3 rounded-md bg-black/45 px-2 py-1 font-mono text-caption text-slate-200 backdrop-blur-sm">
          {project.duration}
        </span>
      </div>
      <div className="space-y-1.5 px-4 py-3.5">
        <h3 className="truncate text-base font-semibold text-[var(--fg-primary)]">
          {project.title}
        </h3>
        <p className="pt-1 font-mono text-caption text-[var(--fg-muted)]">
          {project.layers}
        </p>
      </div>
    </a>
  );
}

/** Shared application shell for the Neonix project hub. */
export async function HubShell() {
  const t = await getTranslations("WorkspaceHome");

  const fallbackProjects: ProjectCardData[] = [
    {
      projectId: "three-kingdoms",
      title: "Three Kingdoms",
      href: "/editor/three-kingdoms",
      layers: t("layers", { count: 14 }),
      duration: "—",
      updatedAt: hoursAgoIso(3),
      accent: "from-cyan-400/25 via-slate-900 to-violet-500/20",
    },
    {
      projectId: "shape",
      title: "Shape composition",
      href: "/editor/shape",
      layers: t("layers", { count: 1 }),
      duration: "—",
      updatedAt: hoursAgoIso(26),
      accent: "from-cyan-300/20 via-slate-900 to-slate-900",
    },
    {
      projectId: "overlap",
      title: "Overlap study",
      href: "/editor/overlap",
      layers: t("layers", { count: 2 }),
      duration: "—",
      updatedAt: hoursAgoIso(50),
      accent: "from-violet-400/25 via-slate-900 to-fuchsia-500/15",
    },
    {
      projectId: "timeline",
      title: "Timeline prototype",
      href: "/editor/timeline",
      layers: t("layers", { count: 6 }),
      duration: "—",
      updatedAt: hoursAgoIso(74),
      accent: "from-amber-300/20 via-slate-900 to-cyan-500/15",
    },
  ];

  // Show local demo cards until project listing is wired to the API.
  const projects = fallbackProjects;

  return (
    <HubFrame>
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="mb-2 text-caption font-semibold tracking-[0.16em] text-[var(--hub-accent)] uppercase">
                  {t("eyebrow")}
                </p>
                <h1 className="m-0 text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)] sm:text-4xl">
                  {t("title")}
                </h1>
                <p className="mt-2 max-w-xl text-base leading-6 text-[var(--fg-muted)]">
                  {t("description")}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <ImportHtmlDialog />
                <NewProjectDialog />
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-2 border-b border-[var(--hub-border)] pb-3">
              <Button variant="ghost" className="h-auto bg-[var(--hub-active)] px-3 py-1.5 text-body text-[var(--fg-primary)]">
                {t("tabs.all")}
              </Button>
              <Button variant="ghost" className="h-auto px-3 py-1.5 text-body">
                {t("tabs.recent")}
              </Button>
              <span className="ml-auto flex items-center gap-2 text-caption text-[var(--fg-disabled)]">
                <FolderKanban className="size-3.5" />
                {t("projectsCount", { count: projects.length, limit: FREE_PROJECT_LIMIT })}
              </span>
            </div>

            <ProjectGrid projects={projects} />
    </HubFrame>
  );
}

function formatDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "—";

  const totalSeconds = Math.ceil(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  return hours > 0
    ? `${hours}:${paddedMinutes}:${paddedSeconds}`
    : `${paddedMinutes}:${paddedSeconds}`;
}
