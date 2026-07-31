import type { RecentProject } from "../../../../src/shared/ipc/contracts";

type Props = {
  recent: RecentProject[];
  error: string | null;
  busy?: boolean;
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (item: RecentProject) => void;
  onDiagnostics: () => void;
  onClearError: () => void;
};

export function HomeScreen({
  recent,
  error,
  busy,
  onNew,
  onOpen,
  onOpenRecent,
  onDiagnostics,
  onClearError,
}: Props) {
  return (
    <main className="home">
      <div className="home__hero">
        <p className="home__eyebrow">MotionVideo</p>
        <h1>Projects</h1>
        <p className="home__lead">
          Create or open a `.mt` project file. Timeline editor ports in a later
          phase — this shell proves open/save lifecycle.
        </p>
        <div className="home__actions">
          <button type="button" className="btn btn--primary" disabled={busy} onClick={onNew}>
            New project
          </button>
          <button type="button" className="btn" disabled={busy} onClick={onOpen}>
            Open…
          </button>
        </div>
        {error ? (
          <p className="home__error" role="alert">
            {error}{" "}
            <button type="button" className="linkish" onClick={onClearError}>
              Dismiss
            </button>
          </p>
        ) : null}
      </div>

      <section className="home__recent">
        <h2>Recent</h2>
        {recent.length === 0 ? (
          <p className="home__muted">No recent projects yet.</p>
        ) : (
          <ul className="home__list">
            {recent.map((item) => (
              <li key={item.path}>
                <button
                  type="button"
                  className="home__recent-item"
                  disabled={busy}
                  onClick={() => onOpenRecent(item)}
                >
                  <span className="home__recent-name">{item.name}</span>
                  <span className="home__recent-path">{item.path}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="home__footer">
        <button type="button" className="linkish" onClick={onDiagnostics}>
          Diagnostics
        </button>
      </footer>
    </main>
  );
}
