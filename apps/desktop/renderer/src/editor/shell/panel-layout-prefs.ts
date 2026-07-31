/**
 * Persist panel sizes as UI preference (localStorage) — never into project document.
 */

export type PanelLayoutPrefs = {
  sidebarWidth: number;
  inspectorWidth: number;
  timelineHeight: number;
};

const KEY = "motionvideo.desktop.panelLayout.v1";

export const DEFAULT_PANEL_LAYOUT: PanelLayoutPrefs = {
  sidebarWidth: 260,
  inspectorWidth: 300,
  timelineHeight: 240,
};

export function loadPanelLayoutPrefs(): PanelLayoutPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PANEL_LAYOUT };
    const parsed = JSON.parse(raw) as Partial<PanelLayoutPrefs>;
    return {
      sidebarWidth: clamp(
        parsed.sidebarWidth ?? DEFAULT_PANEL_LAYOUT.sidebarWidth,
        180,
        480,
      ),
      inspectorWidth: clamp(
        parsed.inspectorWidth ?? DEFAULT_PANEL_LAYOUT.inspectorWidth,
        220,
        480,
      ),
      timelineHeight: clamp(
        parsed.timelineHeight ?? DEFAULT_PANEL_LAYOUT.timelineHeight,
        160,
        560,
      ),
    };
  } catch {
    return { ...DEFAULT_PANEL_LAYOUT };
  }
}

export function savePanelLayoutPrefs(prefs: PanelLayoutPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
