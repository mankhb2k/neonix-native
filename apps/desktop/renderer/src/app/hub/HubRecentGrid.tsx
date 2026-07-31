import type { RecentProject } from "../../../../src/shared/ipc/contracts";
import { Search } from "../../ui";
import { useMemo, useState } from "react";
import { FolderOpen, Plus } from "lucide-react";
import { Button } from "../../ui";

type Props = {
  recent: RecentProject[];
  busy?: boolean;
  onNew: () => void;
  onOpenRecent: (item: RecentProject) => void;
};

export function HubRecentGrid({ recent, busy, onNew, onOpenRecent }: Props) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recent;
    return recent.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q),
    );
  }, [query, recent]);

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg-app)]">
      <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-3">
        <h2 className="m-0 text-[15px] font-semibold text-[var(--fg-primary)]">
          Recent projects
        </h2>
        <div className="ml-auto w-56">
          <Search
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recent…"
          />
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
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 p-0">
            {filtered.map((item) => (
              <li key={item.path}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onOpenRecent(item)}
                  className="flex h-full w-full cursor-pointer flex-col gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-panel)] p-3 text-left transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="inline-flex h-24 items-center justify-center rounded-md bg-[var(--bg-elevated)] text-[var(--fg-muted)]">
                    <FolderOpen size={28} />
                  </span>
                  <span className="truncate text-[13px] font-medium text-[var(--fg-primary)]">
                    {item.name}
                  </span>
                  <span className="truncate text-[11px] text-[var(--fg-muted)]">
                    {item.path}
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
