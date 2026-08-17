export type TimelineLane = {
  id: string;
  start: number;
  duration: number;
};

export function TimelineStrip({
  lanes,
  duration,
  hideHeading = false,
}: {
  lanes: TimelineLane[];
  duration: number;
  hideHeading?: boolean;
}) {
  const total = Math.max(duration, 0.001);
  const ticks = Array.from({ length: Math.floor(total) + 1 }, (_, i) => i);
  return (
    <section className="my-8">
      {hideHeading ? null : (
        <h2 className="mb-3 text-xl font-semibold tracking-tight">Timeline</h2>
      )}
      <div className="rounded-xl border border-[var(--border-subtle,#e4e4e7)] bg-[var(--bg-surface)] p-3 font-mono text-[12px]">
        {lanes.map((lane) => {
          const left = (lane.start / total) * 100;
          const width = (lane.duration / total) * 100;
          return (
            <div key={lane.id} className="mb-2 flex items-center gap-3 last:mb-0">
              <span className="w-28 shrink-0 truncate text-[var(--fg-muted)]">
                {lane.id}
              </span>
              <div className="relative h-4 flex-1 rounded bg-[var(--bg-elevated)]">
                <div
                  className="absolute top-0 h-4 rounded bg-[var(--accent)]/70"
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
        <div className="mt-2 flex items-start gap-3">
          <span className="w-28 shrink-0" />
          <div className="relative h-5 flex-1 text-[11px] text-[var(--fg-muted)]">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute -translate-x-1/2"
                style={{ left: `${(t / total) * 100}%` }}
              >
                {t}s
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function lanesFromProject(project: {
  layers?: unknown[];
  timeline?: { duration?: number };
}): { lanes: TimelineLane[]; duration: number } {
  const layers = Array.isArray(project.layers) ? project.layers : [];
  const lanes: TimelineLane[] = [];
  for (const layer of layers) {
    if (!layer || typeof layer !== "object") continue;
    const rec = layer as {
      id?: unknown;
      parentLayerId?: unknown;
      timing?: { start?: number; duration?: number };
    };
    if (rec.parentLayerId !== null && rec.parentLayerId !== undefined) continue;
    if (typeof rec.id !== "string" || !rec.timing) continue;
    lanes.push({
      id: rec.id,
      start: rec.timing.start ?? 0,
      duration: rec.timing.duration ?? 0,
    });
  }
  const duration =
    project.timeline?.duration ??
    Math.max(0, ...lanes.map((l) => l.start + l.duration), 1);
  return { lanes, duration };
}
