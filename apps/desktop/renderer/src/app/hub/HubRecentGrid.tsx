import { FolderOpen, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Search, Select } from "../../ui";
import type { RecentProject } from "../../../../src/shared/ipc/contracts";

const VIEW_KEY = "moticlip.hub.view";
const SORT_KEY = "moticlip.hub.sort";

type ViewMode = "grid" | "list";
type SortMode = "recent" | "name";

type Props = {
  recent: RecentProject[];
  busy?: boolean;
  onNew: () => void;
  onOpenRecent: (item: RecentProject) => void;
};

function loadView(): ViewMode {
  if (typeof localStorage === "undefined") return "grid";
  return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
}

function loadSort(): SortMode {
  if (typeof localStorage === "undefined") return "recent";
  return localStorage.getItem(SORT_KEY) === "name" ? "name" : "recent";
}

export function HubRecentGrid({ recent, busy, onNew, onOpenRecent }: Props) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>(loadView);
  const [sort, setSort] = useState<SortMode>(loadSort);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = recent;
    if (q) {
      items = recent.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.path.toLowerCase().includes(q),
      );
    }
    const sorted = [...items];
    if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    }
    return sorted;
  }, [query, recent, sort]);

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg-app)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-3">
        <h2 className="m-0 text-[15px] font-semibold text-[var(--fg-primary)]">
          Recent projects
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            aria-label="Sort recent projects"
            value={sort}
            onChange={(e) => {
              const next = e.target.value === "name" ? "name" : "recent";
              setSort(next);
              localStorage.setItem(SORT_KEY, next);
            }}
            options={[
              { value: "recent", label: "Recent" },
              { value: "name", label: "Name" },
            ]}
          />
          <Select
            aria-label="View mode"
            value={view}
            onChange={(e) => {
              const next = e.target.value === "list" ? "list" : "grid";
              setView(next);
              localStorage.setItem(VIEW_KEY, next);
            }}
            options={[
              { value: "grid", label: "Grid" },
              { value: "list", label: "List" },
            ]}
          />
          <div className="w-56">
            <Search
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recent…"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-start gap-3 text-[var(--fg-muted)]">
            <p className="m-0">No recent projects yet.</p>
            <Button
              variant="primary"
              disabled={busy}
              leftIcon={<Plus size={14} />}
              onClick={onNew}
            >
              Create your first project
            </Button>
          </div>
        ) : (
          <ul
            className={
              view === "grid"
                ? "m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 p-0"
                : "m-0 flex list-none flex-col gap-2 p-0"
            }
          >
            {filtered.map((item) => (
              <li key={item.path}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onOpenRecent(item)}
                  className={
                    view === "grid"
                      ? "flex h-full w-full cursor-pointer flex-col gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-panel)] p-3 text-left transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                      : "flex w-full cursor-pointer items-center gap-3 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-panel)] px-3 py-2 text-left transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  }
                >
                  <span
                    className={
                      view === "grid"
                        ? "inline-flex h-24 items-center justify-center rounded-md bg-[var(--bg-elevated)] text-[var(--fg-muted)]"
                        : "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--bg-elevated)] text-[var(--fg-muted)]"
                    }
                  >
                    <FolderOpen size={view === "grid" ? 28 : 18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-[var(--fg-primary)]">
                        {item.name}
                      </span>
                      {item.aspectRatio ? (
                        <span className="shrink-0 rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--fg-muted)]">
                          {item.aspectRatio}
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--fg-muted)]">
                      {item.path}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
