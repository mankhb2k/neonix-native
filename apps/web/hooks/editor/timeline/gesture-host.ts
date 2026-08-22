/**
 * Platform host adapters for clip-move gestures (DOM drop host, scroll, etc.).
 * Apps supply these; editor-react does not own the drop-host registry.
 */

import type {
  TimelineClip,
  TimelineLane,
  TimelineTrackKind,
} from "@motionvideo/editor-core";
import type { ClipMoveDropTarget } from "@motionvideo/editor-core";

/** CapCut-style drop target from editor-core policy / app DOM collectors. */
export type ClipMovePolicyTarget = {
  family: "visual" | "audio";
  isInsert: boolean;
  laneId: string | null;
  insertOrder: number | null;
  indicatorTop: number;
  overBaseBody?: boolean;
};

export type ClipMoveLaneHitLayout = {
  topPadding: number;
  laneHeightPrefix: readonly number[];
  laneContentHeights: readonly number[];
};

export type ClipMoveDropLaneRef = {
  id: string;
  order: number;
  role: "base" | "overlay" | "audio";
};

export type ClipMoveDropContext = {
  scrollEl: HTMLElement;
  lanes: TimelineLane[];
  clipsByLane?: ReadonlyMap<
    string,
    ReadonlyArray<Pick<TimelineClip, "id" | "startTime" | "duration">>
  >;
  siblingLaneRefs?: ReadonlyArray<ClipMoveDropLaneRef>;
  overlayLaneRefs?: ReadonlyArray<ClipMoveDropLaneRef>;
  audioLaneRefs?: ReadonlyArray<ClipMoveDropLaneRef>;
  laneHitLayout?: ClipMoveLaneHitLayout;
};

export type ClipMoveHost = {
  autoScrollNearEdge: (clientX: number, clientY: number) => void;
  pointerContentXAtPoint: (clientX: number) => number | null;
  getDropContext: () => ClipMoveDropContext | null;
  resolveDropAtY: (
    scrollEl: HTMLElement,
    clientY: number,
    family: "visual" | "audio",
    wasInsert: boolean,
    lanes: TimelineLane[],
    layout?: ClipMoveLaneHitLayout,
  ) => ClipMovePolicyTarget | null;
  trackForLane: (lane: TimelineLane | undefined) => TimelineTrackKind;
  laneRowHeightPx: (lane: TimelineLane) => number;
  /** Group surface: one child per row (swap / insert, never pack). */
  exclusiveRows?: boolean;
};

export type LayerMoveInsertGap = {
  insertBeforeIndex: number;
  contentTop: number;
  laneId: string;
};

export type LayerMoveHost = {
  autoScrollNearEdge: (clientX: number, clientY: number) => void;
  pointerContentXAtPoint: (clientX: number) => number | null;
  resolveInsertGapAtClientY: (
    clientY: number,
  ) => LayerMoveInsertGap | null;
};

/** Re-export for adapters building ClipMoveDropTarget. */
export type { ClipMoveDropTarget };
