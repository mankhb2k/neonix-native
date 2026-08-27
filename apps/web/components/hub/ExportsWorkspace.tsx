"use client";

import { AlertCircle, CheckCircle2, Clock3, Download, Grid2X2, List, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { dashboardHref } from "@/components/AppLink";

type ViewMode = "list" | "grid";

const statusCards = [
  { label: "Total exports", value: "0", icon: Download },
  { label: "Ready", value: "0", icon: CheckCircle2 },
  { label: "Processing", value: "0", icon: Clock3 },
  { label: "Failed", value: "0", icon: AlertCircle },
] as const;

export function ExportsWorkspace() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

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
          defaultValue="all"
          className="h-10 rounded-lg border border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-3 text-body text-[var(--fg-muted)] outline-none focus:border-[var(--hub-accent)]"
        >
          <option value="all">All statuses</option>
          <option value="ready">Ready</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
        </select>
        <span className="text-caption text-[var(--fg-muted)]">0 files</span>
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

      <div className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-6 py-16 text-center">
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
