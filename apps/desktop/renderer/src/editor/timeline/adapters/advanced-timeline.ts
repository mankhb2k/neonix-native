/**
 * UI-6 advanced timeline behaviors — policy stubs + adapter seam.
 * Full DOM ports land incrementally; each behavior needs editor-core policy + Vite adapter + test.
 */

export type AdvancedTimelineBehavior =
  | "cross-lane-move"
  | "lane-drop"
  | "auto-scroll"
  | "marquee"
  | "library-dnd"
  | "lane-reorder"
  | "clipboard"
  | "drag-preview";

export const ADVANCED_TIMELINE_BEHAVIORS: AdvancedTimelineBehavior[] = [
  "cross-lane-move",
  "lane-drop",
  "auto-scroll",
  "marquee",
  "library-dnd",
  "lane-reorder",
  "clipboard",
  "drag-preview",
];

/** Behaviors already covered by Vite adapters / session (partial → growing). */
export function isBehaviorScaffolded(
  behavior: AdvancedTimelineBehavior,
): boolean {
  return (
    behavior === "clipboard" ||
    behavior === "library-dnd" ||
    behavior === "lane-drop" ||
    behavior === "auto-scroll" ||
    behavior === "drag-preview" ||
    behavior === "lane-reorder" ||
    behavior === "cross-lane-move" ||
    behavior === "marquee"
  );
}
