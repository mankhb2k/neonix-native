"use client";

import { AlertCircle, CheckCircle2, Clock3, Download, Grid2X2, List, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { dashboardHref } from "@/components/AppLink";

type ViewMode = "list" | "grid";

type ExportJob = { jobId: string; projectId: string; status: string; progress: number; stage?: string; error?: string; artifactPath?: string; outputKey?: string; metrics?: { outputSizeInBytes?: number; displayCost?: number; estimatedBillingDurationInMilliseconds?: number }; createdAt: number; };

export function ExportsWorkspace() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const response = await globalThis.fetch("/api/v1/renders", { cache: "no-store" });
      if (!response.ok) {
        if (active) setLoadError(`Unable to load exports (${response.status})`);
        return;
      }
      const data = await response.json() as { jobs?: ExportJob[] };
      if (active) {
        setLoadError(null);
        setJobs(data.jobs ?? []);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const visibleJobs = useMemo(() => jobs.filter((job) => statusFilter === "all" || (statusFilter === "ready" ? job.status === "done" : statusFilter === "processing" ? ["queued", "rendering", "encoding"].includes(job.status) : job.status === "failed")), [jobs, statusFilter]);
  const statusCards = [
    { label: "Total exports", value: String(jobs.length), icon: Download },
    { label: "Ready", value: String(jobs.filter((job) => job.status === "done").length), icon: CheckCircle2 },
    { label: "Processing", value: String(jobs.filter((job) => ["queued", "rendering", "encoding"].includes(job.status)).length), icon: Clock3 },
    { label: "Failed", value: String(jobs.filter((job) => job.status === "failed").length), icon: AlertCircle },
  ] as const;

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-caption font-semibold tracking-[0.16em] text-[var(--hub-accent)] uppercase">
            Render library
          </p>
          <h1 className="m-0 text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)] sm:text-4xl">
            Exports
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--fg-muted)]">
            Download finished videos and keep track of your export history.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-4 py-2.5 text-body font-medium text-[var(--fg-muted)]">
          <Download className="size-4" />
          Export from editor
        </span>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statusCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-caption text-[var(--fg-muted)]">{card.label}</span>
                <Icon className="size-4 text-[var(--hub-accent)]" />
              </div>
              <p className="mt-2 m-0 font-mono text-xl font-semibold text-[var(--fg-primary)]">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-3 border-b border-[var(--hub-border)] pb-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--fg-disabled)]" />
          <span className="sr-only">Search exports</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search exports"
            className="h-10 w-full rounded-lg border border-[var(--hub-border)] bg-[var(--hub-card-bg)] pl-9 pr-3 text-body text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-disabled)] focus:border-[var(--hub-accent)]"
          />
        </label>
        <select
          aria-label="Filter exports by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-10 rounded-lg border border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-3 text-body text-[var(--fg-muted)] outline-none focus:border-[var(--hub-accent)]"
        >
          <option value="all">All statuses</option>
          <option value="ready">Ready</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
        </select>
        <span className="text-caption text-[var(--fg-muted)]">{visibleJobs.length} files</span>
        <div className="flex items-center gap-1 sm:ml-auto" aria-label="Export view">
          <button
            type="button"
            aria-label="List view"
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
            className={`rounded-md p-2 transition ${viewMode === "list" ? "bg-[var(--hub-active)] text-[var(--fg-primary)]" : "text-[var(--fg-muted)] hover:bg-[var(--hub-hover)] hover:text-[var(--fg-primary)]"}`}
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Card view"
            aria-pressed={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
            className={`rounded-md p-2 transition ${viewMode === "grid" ? "bg-[var(--hub-active)] text-[var(--fg-primary)]" : "text-[var(--fg-muted)] hover:bg-[var(--hub-hover)] hover:text-[var(--fg-primary)]"}`}
          >
            <Grid2X2 className="size-4" />
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      ) : null}

      {visibleJobs.length > 0 ? (
        <div className="mt-6 space-y-2">
          {visibleJobs.map((job) => (
            <div key={job.jobId} className="flex flex-col gap-3 rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="m-0 text-body font-semibold text-[var(--fg-primary)]">{job.projectId}</p>
                <p className="mt-1 m-0 text-caption text-[var(--fg-muted)]">{job.jobId} · {job.stage ?? job.status}</p>
              </div>
              <div className="flex items-center justify-end gap-4 text-right text-caption text-[var(--fg-muted)]">
                <p className="m-0 font-medium text-[var(--fg-primary)]">{job.status} · {Math.round(job.progress * 100)}%</p>
                <p className="mt-1 m-0">{job.metrics?.outputSizeInBytes ? `${Math.round(job.metrics.outputSizeInBytes / 1024 / 1024 * 100) / 100} MB` : "Awaiting metrics"}</p>
                {job.status === "done" ? (
                  <button
                    type="button"
                    disabled={downloadingJobId === job.jobId}
                    className="rounded-lg border border-[var(--hub-border)] px-3 py-2 text-body font-medium text-[var(--fg-primary)] hover:bg-[var(--hub-hover)] disabled:opacity-60"
                    onClick={async () => {
                      setDownloadingJobId(job.jobId);
                      try {
                        const response = await fetch(`/api/v1/renders/${encodeURIComponent(job.jobId)}/download`, { cache: "no-store" });
                        if (!response.ok) throw new Error(`Download unavailable (${response.status})`);
                        const data = await response.json() as { url?: string };
                        if (!data.url) throw new Error("Download URL is missing");
                        window.location.assign(data.url);
                      } catch (error) {
                        setLoadError(error instanceof Error ? error.message : "Download failed");
                      } finally {
                        setDownloadingJobId(null);
                      }
                    }}
                  >
                    {downloadingJobId === job.jobId ? "Preparing…" : "Download"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className={jobs.length > 0 ? "hidden" : "mt-6 flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-6 py-16 text-center"}>
        <span className="flex size-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--hub-accent)]">
          <Download className="size-5" />
        </span>
        <p className="mt-4 text-body font-semibold text-[var(--fg-primary)]">
          {search.trim() ? "No matching exports" : "No exports yet"}
        </p>
        <p className="mt-1 max-w-sm text-caption text-[var(--fg-muted)]">
          {search.trim()
            ? "Try a different search term."
            : "Export a project from the editor and your MP4 files will appear here."}
        </p>
        {!search.trim() ? (
          <Link
            href={dashboardHref()}
            className="mt-5 rounded-lg border border-[var(--hub-border)] px-3.5 py-2 text-body font-medium text-[var(--fg-primary)] no-underline transition hover:bg-[var(--hub-hover)]"
          >
            Browse projects
          </Link>
        ) : null}
      </div>

      <p className="mt-4 text-caption text-[var(--fg-disabled)]">
        Exported files count toward your workspace storage limit.
      </p>
    </div>
  );
}
