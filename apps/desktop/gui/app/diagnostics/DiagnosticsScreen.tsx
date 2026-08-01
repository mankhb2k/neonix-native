import { useEffect, useState } from "react";
import type { DesktopAPI, DesktopInfo } from "../../../shared/ipc/contracts";
import "./diagnostics.css";

type Props = {
  api: DesktopAPI;
  onBack?: () => void;
};

export function DiagnosticsScreen({ api, onBack }: Props) {
  const [info, setInfo] = useState<DesktopInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.app.getInfo().then(
      (value) => {
        if (!cancelled) setInfo(value);
      },
      (err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <main className="diagnostics">
      {onBack ? (
        <p>
          <button type="button" className="btn" onClick={onBack}>
            ← Back
          </button>
        </p>
      ) : null}
      <header className="diagnostics__header">
        <p className="diagnostics__eyebrow">MotionVideo Desktop</p>
        <h1>Diagnostics</h1>
        <p className="diagnostics__lead">
          Bridge smoke tests — nested DesktopAPI via desktop-api-client.
        </p>
      </header>

      <section className="diagnostics__panel">
        <h2>Bridge</h2>
        {error ? <p className="diagnostics__error">{error}</p> : null}
        {!error && !info ? (
          <p className="diagnostics__muted">Loading getInfo…</p>
        ) : null}
        {info ? (
          <dl className="diagnostics__grid">
            <div>
              <dt>platform</dt>
              <dd>{info.platform}</dd>
            </div>
            <div>
              <dt>version</dt>
              <dd>{info.version}</dd>
            </div>
            <div>
              <dt>packaged</dt>
              <dd>{String(info.packaged)}</dd>
            </div>
            <div>
              <dt>renderer</dt>
              <dd>{info.renderer}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      <section className="diagnostics__panel">
        <h2>Window</h2>
        <div className="diagnostics__actions">
          <button type="button" onClick={() => void api.window.minimize()}>
            Minimize
          </button>
          <button
            type="button"
            onClick={() => void api.window.toggleMaximize()}
          >
            Maximize
          </button>
          <button type="button" onClick={() => void api.window.close()}>
            Close
          </button>
        </div>
        <p className="diagnostics__muted">
          DevTools: F12 or Ctrl+Shift+I (unpackaged builds).
        </p>
      </section>

      <section className="diagnostics__panel">
        <h2>Static asset smoke</h2>
        <img
          className="diagnostics__mark"
          src="/brand-mark.svg"
          width={48}
          height={48}
          alt="Brand mark"
        />
      </section>
    </main>
  );
}
