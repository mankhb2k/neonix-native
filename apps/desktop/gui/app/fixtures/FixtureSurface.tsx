/**
 * Static surfaces for screenshot baselines — no IPC / project load.
 */

import type { UiFixtureId } from "./ui-fixture";

type Props = { fixture: UiFixtureId };

export function FixtureSurface({ fixture }: Props) {
  return (
    <main
      className="fixture-surface"
      data-testid="ui-fixture"
      data-fixture={fixture}
    >
      <header className="fixture-surface__chrome">
        <span className="fixture-surface__brand">MotionVideo</span>
        <span className="fixture-surface__label">{fixture}</span>
      </header>
      {fixture === "home-empty" || fixture === "home-recent" ? (
        <section className="fixture-surface__home">
          <h1>Projects</h1>
          {fixture === "home-empty" ? (
            <p className="fixture-surface__muted">No recent projects</p>
          ) : (
            <ul className="fixture-surface__list">
              <li>Demo Reel.moticlip</li>
              <li>Unicode プロジェクト.moticlip</li>
            </ul>
          )}
          <div className="fixture-surface__actions">
            <button type="button">New</button>
            <button type="button">Open</button>
          </div>
        </section>
      ) : null}
      {fixture === "editor-shell" ||
      fixture === "sidebar-layers" ||
      fixture === "timeline-empty" ? (
        <section className="fixture-surface__editor">
          <aside
            className={
              fixture === "sidebar-layers"
                ? "fixture-surface__sidebar fixture-surface__sidebar--focus"
                : "fixture-surface__sidebar"
            }
          >
            <h2>Layers</h2>
            <ul>
              <li>Base</li>
              <li>Overlay 1</li>
              <li>Audio</li>
            </ul>
          </aside>
          <div className="fixture-surface__stage">Preview</div>
          <div
            className={
              fixture === "timeline-empty"
                ? "fixture-surface__timeline fixture-surface__timeline--focus"
                : "fixture-surface__timeline"
            }
          >
            Timeline
          </div>
        </section>
      ) : null}
    </main>
  );
}
