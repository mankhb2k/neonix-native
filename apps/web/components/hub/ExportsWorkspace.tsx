"use client";

import { AlertCircle, CheckCircle2, Clock3, Download, Grid2X2, List, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dashboardHref } from "@/components/AppLink";
import { apiFetch } from "@/lib/api/client";

type ViewMode = "list" | "grid";
type StatusFilter = "all" | "ready" | "processing" | "failed" | "cancelled";

type ExportJob = {
  jobId: string;
  projectId: string;
  status: string;
  progress: number;
  stage?: string;
  error?: string;
  artifactPath?: string;
  outputKey?: string;
  metrics?: {
    outputSizeInBytes?: number;
    displayCost?: number;
    estimatedBillingDurationInMilliseconds?: number;
    verifiedDurationSeconds?: number;
    verifiedWidth?: number;
    verifiedHeight?: number;
    verifiedFps?: number;
  };
  createdAt: number;
};

const PROCESSING_STATUSES = new Set(["queued", "rendering", "encoding", "publishing", "finalizing"]);
const FAILED_STATUSES = new Set(["failed"]);
const CANCELLED_STATUSES = new Set(["cancelled"]);

function formatBytes(bytes: number | undefined, t: ReturnType<typeof useTranslations>): string {
  if (!bytes || bytes <= 0) return t("awaitingMetrics");
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(seconds?: number): string | null {
  if (seconds === undefined || !Number.isFinite(seconds)) return null;
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remaining = String(total % 60).padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function formatDate(timestamp: number, t: ReturnType<typeof useTranslations>): string {
  if (!Number.isFinite(timestamp)) return t("unknownDate");
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));
}

const KNOWN_STATUSES = ["queued", "rendering", "encoding", "publishing", "finalizing", "failed", "cancelled", "done"] as const;

function statusLabel(status: string, t: ReturnType<typeof useTranslations>): string {
  if ((KNOWN_STATUSES as readonly string[]).includes(status)) {
    return t(`statusLabels.${status as (typeof KNOWN_STATUSES)[number]}`);
  }
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusMatches(status: string, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "ready") return status === "done";
  if (filter === "processing") return PROCESSING_STATUSES.has(status);
  if (filter === "failed") return FAILED_STATUSES.has(status);
  return CANCELLED_STATUSES.has(status);
}

export function ExportsWorkspace() {
  const t = useTranslations("ExportsWorkspace");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);

  const loadJobs = useCallback(async (options: { initial?: boolean } = {}) => {
    if (options.initial) setLoading(true);
    else setRefreshing(true);
    try {
      const response = await apiFetch("/v1/renders", { cache: "no-store" });
      if (!response.ok) throw new Error(t("errors.loadingFormat", { status: response.status }));
      const data = await response.json() as { jobs?: ExportJob[] };
      setLoadError(null);
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t("errors.loadFallback"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    let active = true;
    void loadJobs({ initial: true });
    const timer = window.setInterval(() => {
      if (active) void loadJobs();
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [loadJobs]);

  const normalizedSearch = search.trim().toLowerCase();
  const visibleJobs = useMemo(() => jobs.filter((job) => {
    if (!statusMatches(job.status, statusFilter)) return false;
    if (!normalizedSearch) return true;
    return [job.projectId, job.jobId, job.outputKey, job.stage, job.status]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  }), [jobs, normalizedSearch, statusFilter]);

  const statusCards = [
    { label: t("stats.total"), value: String(jobs.length), icon: Download },
    { label: t("stats.ready"), value: String(jobs.filter((job) => job.status === "done").length), icon: CheckCircle2 },
    { label: t("stats.processing"), value: String(jobs.filter((job) => PROCESSING_STATUSES.has(job.status)).length), icon: Clock3 },
    { label: t("stats.failed"), value: String(jobs.filter((job) => FAILED_STATUSES.has(job.status)).length), icon: AlertCircle },
  ];

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-caption font-semibold tracking-[0.16em] text-[var(--hub-accent)] uppercase">{t("eyebrow")}</p>
          <h1 className="m-0 text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)] sm:text-4xl">{t("title")}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--fg-muted)]">{t("description")}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadJobs()}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-4 py-2.5 text-body font-medium text-[var(--fg-primary)] transition hover:bg-[var(--hub-hover)] disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          {t("refresh")}
        </button>
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
          <span className="sr-only">{t("search.label")}</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("search.placeholder")} className="h-10 w-full rounded-lg border border-[var(--hub-border)] bg-[var(--hub-card-bg)] pl-9 pr-3 text-body text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-disabled)] focus:border-[var(--hub-accent)]" />
        </label>
        <select aria-label={t("filter.aria")} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="h-10 rounded-lg border border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-3 text-body text-[var(--fg-muted)] outline-none focus:border-[var(--hub-accent)]">
          <option value="all">{t("filter.all")}</option>
          <option value="ready">{t("filter.ready")}</option>
          <option value="processing">{t("filter.processing")}</option>
          <option value="failed">{t("filter.failed")}</option>
          <option value="cancelled">{t("filter.cancelled")}</option>
        </select>
        <span className="text-caption text-[var(--fg-muted)]">{t("counts.files", { count: visibleJobs.length })}</span>
        <div className="flex items-center gap-1 sm:ml-auto" aria-label={t("view.exportAria")}>
          <button type="button" aria-label={t("view.listAria")} aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")} className={`rounded-md p-2 transition ${viewMode === "list" ? "bg-[var(--hub-active)] text-[var(--fg-primary)]" : "text-[var(--fg-muted)] hover:bg-[var(--hub-hover)] hover:text-[var(--fg-primary)]"}`}><List className="size-4" /></button>
          <button type="button" aria-label={t("view.cardAria")} aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")} className={`rounded-md p-2 transition ${viewMode === "grid" ? "bg-[var(--hub-active)] text-[var(--fg-primary)]" : "text-[var(--fg-muted)] hover:bg-[var(--hub-hover)] hover:text-[var(--fg-primary)]"}`}><Grid2X2 className="size-4" /></button>
        </div>
      </div>

      {loadError ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div> : null}

      {loading ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--hub-border)] px-6 py-16 text-center text-sm text-[var(--fg-muted)]">{t("loading")}</div>
      ) : visibleJobs.length > 0 ? (
        <div className={viewMode === "grid" ? "mt-6 grid gap-3 md:grid-cols-2" : "mt-6 space-y-2"}>
          {visibleJobs.map((job) => {
            const duration = formatDuration(job.metrics?.verifiedDurationSeconds);
            const resolution = job.metrics?.verifiedWidth && job.metrics?.verifiedHeight ? `${job.metrics.verifiedWidth}x${job.metrics.verifiedHeight}` : null;
            return (
              <div key={job.jobId} className={`flex flex-col gap-3 rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-4 py-3 ${viewMode === "list" ? "sm:flex-row sm:items-center sm:justify-between" : "min-h-44"}`}>
                <div className="min-w-0">
                  <p className="m-0 truncate text-body font-semibold text-[var(--fg-primary)]">{t("projectLabel", { id: job.projectId })}</p>
                  <p className="mt-1 truncate text-caption text-[var(--fg-muted)]">{job.jobId} · {formatDate(job.createdAt, t)}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-caption text-[var(--fg-muted)]">
                    <span className="font-medium text-[var(--fg-primary)]">{statusLabel(job.status, t)} · {Math.round(job.progress * 100)}%</span>
                    <span>{formatBytes(job.metrics?.outputSizeInBytes, t)}</span>
                    {duration ? <span>{duration}</span> : null}
                    {resolution ? <span>{resolution}</span> : null}
                  </div>
                  {job.error ? <p className="mt-2 text-caption text-red-600">{job.error}</p> : null}
                </div>
                {job.status === "done" ? (
                  <button type="button" disabled={downloadingJobId === job.jobId} className="shrink-0 rounded-lg border border-[var(--hub-border)] px-3 py-2 text-body font-medium text-[var(--fg-primary)] hover:bg-[var(--hub-hover)] disabled:opacity-60" onClick={async () => {
                    setDownloadingJobId(job.jobId);
                    try {
                      const response = await apiFetch(`/v1/renders/${encodeURIComponent(job.jobId)}/download`, { cache: "no-store" });
                      if (!response.ok) throw new Error(t("errors.downloadUnavailable", { status: response.status }));
                      const data = await response.json() as { url?: string };
                      if (!data.url) throw new Error(t("errors.downloadUrlMissing"));
                      window.location.assign(data.url);
                    } catch (error) {
                      setLoadError(error instanceof Error ? error.message : t("errors.downloadFailed"));
                    } finally {
                      setDownloadingJobId(null);
                    }
                  }}>{downloadingJobId === job.jobId ? t("downloadPreparing") : t("download")}</button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-6 py-16 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--hub-accent)]"><Download className="size-5" /></span>
          <p className="mt-4 text-body font-semibold text-[var(--fg-primary)]">{jobs.length === 0 ? t("empty.noneTitle") : t("empty.noMatchTitle")}</p>
          <p className="mt-1 max-w-sm text-caption text-[var(--fg-muted)]">{jobs.length === 0 ? t("empty.noneDescription") : t("empty.noMatchDescription")}</p>
          {jobs.length === 0 ? <Link href={dashboardHref("/dashboard/projects")} className="mt-5 rounded-lg border border-[var(--hub-border)] px-3.5 py-2 text-body font-medium text-[var(--fg-primary)] no-underline transition hover:bg-[var(--hub-hover)]">{t("browseProjects")}</Link> : null}
        </div>
      )}

      <p className="mt-4 text-caption text-[var(--fg-disabled)]">{t("storageNote")}</p>
    </div>
  );
}
