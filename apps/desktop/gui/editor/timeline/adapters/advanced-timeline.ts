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

export type BehaviorScaffoldStatus = "none" | "partial" | "done";

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

/**
 * Honest scaffold map — not every listed behavior is fully shipped.
 * `done` = usable end-to-end in Vite session; `partial` = adapter/UI present with gaps.
 */
export const BEHAVIOR_SCAFFOLD_STATUS: Record<
  AdvancedTimelineBehavior,
  BehaviorScaffoldStatus
> = {
  clipboard: "done",
  marquee: "done",
  "cross-lane-move": "done",
  "lane-drop": "partial",
  "auto-scroll": "partial",
  "library-dnd": "partial",
  "lane-reorder": "partial",
  "drag-preview": "partial",
};

export function getBehaviorScaffoldStatus(
  behavior: AdvancedTimelineBehavior,
): BehaviorScaffoldStatus {
  return BEHAVIOR_SCAFFOLD_STATUS[behavior];
}

/** True when any scaffold exists (partial or done). */
export function isBehaviorScaffolded(
  behavior: AdvancedTimelineBehavior,
): boolean {
  return BEHAVIOR_SCAFFOLD_STATUS[behavior] !== "none";
}
