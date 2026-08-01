/**
 * Deterministic UI fixture mode for visual baselines (?fixture= or env).
 */

export const UI_FIXTURE_IDS = [
  "hub-empty",
  "hub-recent",
  "editor-shell",
  "sidebar-layers",
  "timeline-empty",
] as const;

export type UiFixtureId = (typeof UI_FIXTURE_IDS)[number];

export function readUiFixtureId(): UiFixtureId | null {
  if (typeof window === "undefined") return null;
  const fromQuery = new URLSearchParams(window.location.search).get("fixture");
  const fromEnv =
    typeof import.meta !== "undefined" &&
    typeof import.meta.env?.VITE_UI_FIXTURE === "string"
      ? import.meta.env.VITE_UI_FIXTURE
      : null;
  const raw = fromQuery || fromEnv;
  if (!raw) return null;
  return (UI_FIXTURE_IDS as readonly string[]).includes(raw)
    ? (raw as UiFixtureId)
    : null;
}
