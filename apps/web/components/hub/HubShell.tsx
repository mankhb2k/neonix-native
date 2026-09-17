import { FolderKanban, Plus } from "lucide-react";
import Link from "next/link";
import { dashboardHref } from "@/components/AppLink";
import { HubFrame } from "@/components/hub/HubFrame";
import { listProjects } from "@/lib/editor/document/project-repository";
import { appUrl } from "@/lib/hosts";

type ProjectCardData = {
  title: string;
  href: string;
  layers: string;
  duration: string;
  updated: string;
  accent: string;
};

const FREE_PROJECT_LIMIT = 10;

const fallbackProjects: ProjectCardData[] = [
  {
    title: "Three Kingdoms",
    href: "/editor/three-kingdoms",
    layers: "14 layers",
    duration: "—",
    updated: "Updated today",
    accent: "from-cyan-400/25 via-slate-900 to-violet-500/20",
  },
  {
    title: "Shape composition",
    href: "/editor/shape",
    layers: "1 layer",
    duration: "—",
    updated: "Updated yesterday",
    accent: "from-cyan-300/20 via-slate-900 to-slate-900",
  },
  {
    title: "Overlap study",
    href: "/editor/overlap",
    layers: "2 layers",
    duration: "—",
    updated: "Updated 2 days ago",
    accent: "from-violet-400/25 via-slate-900 to-fuchsia-500/15",
  },
  {
    title: "Timeline prototype",
    href: "/editor/timeline",
    layers: "6 layers",
    duration: "—",
    updated: "Updated 3 days ago",
    accent: "from-amber-300/20 via-slate-900 to-cyan-500/15",
  },
];

function ProjectCard({ project }: { project: ProjectCardData }) {
  return (
    <a
      href={appUrl(project.href)}
      className="group min-w-0 overflow-hidden rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] no-underline transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--hub-accent)_40%,transparent)] hover:bg-[var(--bg-elevated)]"
    >
      <div
        className={`relative aspect-video overflow-hidden bg-gradient-to-br ${project.accent}`}
      >
        <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(135deg,transparent_35%,rgba(255,255,255,0.08)_36%,transparent_37%),linear-gradient(45deg,transparent_48%,rgba(34,211,238,0.12)_49%,transparent_50%)] [background-size:32px_32px,48px_48px]" />
        <span className="absolute bottom-3 left-3 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-caption font-medium text-slate-200 backdrop-blur-sm">
          Protocol V2
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
          {project.layers} · {project.updated}
        </p>
      </div>
    </a>
  );
}

/** Shared application shell for the Neonix project hub. */
export async function HubShell() {
  let projects = fallbackProjects;
  try {
    const rows = await listProjects(50);
    if (rows.length > 0) {
      projects = rows.map((project, index) => ({
        title: project.title,
        href: `/editor/${project.projectId}`,
        layers: `${project.layerCount} ${project.layerCount === 1 ? "layer" : "layers"}`,
        duration: formatDuration(project.durationMs),
        updated: formatUpdated(project.updatedAt),
        accent: [
          "from-cyan-400/25 via-slate-900 to-violet-500/20",
          "from-cyan-300/20 via-slate-900 to-slate-900",
          "from-violet-400/25 via-slate-900 to-fuchsia-500/15",
          "from-amber-300/20 via-slate-900 to-cyan-500/15",
        ][index % 4],
      }));
    }
  } catch {
    // DevDemoAuth bootstraps the browser session after the initial render.
    // Keep the static cards for that first unauthenticated response.
  }

  return (
    <HubFrame>
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="mb-2 text-caption font-semibold tracking-[0.16em] text-[var(--hub-accent)] uppercase">
                  Personal workspace
                </p>
                <h1 className="m-0 text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)] sm:text-4xl">
                  Projects
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--fg-muted)]">
                  Create with Claude, refine in the editor, and export when your
                  motion story is ready.
                </p>
              </div>
              <Link
                href={dashboardHref("/projects/new")}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--hub-accent)] px-4 py-2.5 text-body font-semibold text-[var(--hub-accent-on)] no-underline transition hover:bg-[var(--hub-accent-hover)]"
              >
                <Plus className="size-4" />
                New project
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-2 border-b border-[var(--hub-border)] pb-3">
              <button
                type="button"
                className="rounded-md bg-[var(--hub-active)] px-3 py-1.5 text-body font-medium text-[var(--fg-primary)]"
              >
                All projects
              </button>
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-body font-medium text-[var(--fg-muted)] transition hover:bg-[var(--hub-hover)] hover:text-[var(--fg-primary)]"
              >
                Recent
              </button>
              <span className="ml-auto flex items-center gap-2 text-caption text-[var(--fg-disabled)]">
                <FolderKanban className="size-3.5" />
                {projects.length}/{FREE_PROJECT_LIMIT} projects
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {projects.map((project) => (
                <ProjectCard key={project.title} project={project} />
              ))}
            </div>
    </HubFrame>
  );
}

function formatUpdated(value: string): string {
  const updatedAt = new Date(value);
  if (Number.isNaN(updatedAt.getTime())) return "Updated recently";
  const days = Math.floor((Date.now() - updatedAt.getTime()) / 86_400_000);
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  return `Updated ${days} days ago`;
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
