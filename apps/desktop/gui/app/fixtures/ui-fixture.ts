/**
 * Deterministic UI fixture ids for visual baselines (?fixture=).
 * Active only when VITE_ENABLE_UI_FIXTURES=1 (see seed-production-ui).
 */

export const UI_FIXTURE_IDS = [
  "home-empty",
  "home-recent",
  "editor-shell",
  "sidebar-layers",
  "timeline-empty",
  "sidebar-demo",
] as const;

export type UiFixtureId = (typeof UI_FIXTURE_IDS)[number];

export function readUiFixtureId(): UiFixtureId | null {
  if (typeof window === "undefined") return null;
  if (import.meta.env.VITE_ENABLE_UI_FIXTURES !== "1") return null;
  const fromQuery = new URLSearchParams(window.location.search).get("fixture");
  const raw = fromQuery;
  if (!raw) return null;
  return (UI_FIXTURE_IDS as readonly string[]).includes(raw)
    ? (raw as UiFixtureId)
    : null;
}
