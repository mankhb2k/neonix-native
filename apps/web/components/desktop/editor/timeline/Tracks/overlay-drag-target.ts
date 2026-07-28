/**
 * Pure overlay / main-track drag targeting for the timeline.
 * No React — rect math + insert-line hysteresis only.
 */

/** px below TimeRuler top border — single threshold for card↔cyan (enter & exit) */
export const CYAN_MODE_BELOW_RULER_TOP_PX = 16;
/** Enter insert-line mode only when within this many px of a lane edge */
export const OVERLAY_EDGE_ENTER_PX = 2;
/** Exit insert-line only when this far into the lane body (hysteresis) */
export const OVERLAY_EDGE_EXIT_PX = 10;
/** Skip indicator setState when Y barely moved (cuts dragover re-renders) */
export const INDICATOR_TOP_EPS_PX = 0.5;

export type VideoLaneHit = {
  top: number;
  bottom: number;
  type: "overlay" | "main";
  layerIndex: number | null;
};

export type OverlayDragTarget = {
  isInsert: boolean;
  layer: number | null;
  indicatorTop: number;
};

export function collectVideoLanes(scope: HTMLElement): VideoLaneHit[] {
  const nodes = scope.querySelectorAll<HTMLElement>("[data-track-lane]");
  const out: VideoLaneHit[] = [];
  for (const el of nodes) {
    const type = el.getAttribute("data-track-type");
    if (type !== "overlay" && type !== "main") continue;
    const r = el.getBoundingClientRect();
    const layerAttr = el.getAttribute("data-layer-index");
    out.push({
      top: r.top,
      bottom: r.bottom,
      type,
      layerIndex: layerAttr != null ? Number.parseInt(layerAttr, 10) : null,
    });
  }
  out.sort((a, b) => a.top - b.top);
  return out;
}

function gapMidInWs(
  upper: VideoLaneHit,
  lower: VideoLaneHit,
  wsTop: number,
): number {
  return (upper.bottom + lower.top) / 2 - wsTop;
}

function resolveInsideLane(
  clientY: number,
  lane: VideoLaneHit,
  next: VideoLaneHit | undefined,
  prev: VideoLaneHit | undefined,
  wsTop: number,
  wasInsert: boolean,
): OverlayDragTarget {
  const relY = clientY - lane.top;
  const h = Math.max(lane.bottom - lane.top, 1);
  const inBodyClear =
    relY > OVERLAY_EDGE_EXIT_PX && relY < h - OVERLAY_EDGE_EXIT_PX;
  const nearTopEnter = relY <= OVERLAY_EDGE_ENTER_PX;
  const nearBottomEnter = relY >= h - OVERLAY_EDGE_ENTER_PX;

  const insertAbove = (): OverlayDragTarget => {
    const indicatorTop =
      prev != null ? gapMidInWs(prev, lane, wsTop) : lane.top - wsTop - 1;
    if (lane.type === "overlay" && lane.layerIndex != null) {
      return { isInsert: true, layer: lane.layerIndex + 1, indicatorTop };
    }
    return { isInsert: true, layer: 0, indicatorTop };
  };

  const insertBelow = (): OverlayDragTarget => {
    if (lane.type !== "overlay" || lane.layerIndex == null) {
      return { isInsert: false, layer: null, indicatorTop: 0 };
    }
    const indicatorTop =
      next != null ? gapMidInWs(lane, next, wsTop) : lane.bottom - wsTop - 1;
    return { isInsert: true, layer: lane.layerIndex, indicatorTop };
  };

  const body = (): OverlayDragTarget => {
    if (lane.type === "overlay" && lane.layerIndex != null) {
      return { isInsert: false, layer: lane.layerIndex, indicatorTop: 0 };
    }
    return { isInsert: false, layer: null, indicatorTop: 0 };
  };

  if (lane.type === "main") {
    if (!wasInsert) {
      if (nearTopEnter) return insertAbove();
      return body();
    }
    if (relY > OVERLAY_EDGE_EXIT_PX) return body();
    return insertAbove();
  }

  if (!wasInsert) {
    if (nearTopEnter) return insertAbove();
    if (nearBottomEnter) return insertBelow();
    return body();
  }
  if (inBodyClear) return body();
  if (relY < h / 2) return insertAbove();
  return insertBelow();
}

/**
 * Rect-based hit test (no elementFromPoint). Gaps between lanes always map to
 * "insert below upper" so the cyan line target does not flip each pixel.
 */
export function resolveOverlayDragTarget(
  clientY: number,
  lanes: VideoLaneHit[],
  wsTop: number,
  wasInsert: boolean,
  maxOverlayLayer: number,
): OverlayDragTarget | null {
  if (lanes.length === 0) return null;

  const first = lanes[0];
  if (clientY < first.top) {
    return {
      isInsert: true,
      layer: maxOverlayLayer + 1,
      indicatorTop: first.top - wsTop - 1,
    };
  }

  for (let i = 0; i < lanes.length; i++) {
    const lane = lanes[i];
    const next = lanes[i + 1];
    const prev = i > 0 ? lanes[i - 1] : undefined;

    // Gap → canonical "below upper" (never flip to "above lower")
    if (next && clientY > lane.bottom && clientY < next.top) {
      if (lane.type === "overlay" && lane.layerIndex != null) {
        return {
          isInsert: true,
          layer: lane.layerIndex,
          indicatorTop: gapMidInWs(lane, next, wsTop),
        };
      }
      return {
        isInsert: true,
        layer: 0,
        indicatorTop: gapMidInWs(lane, next, wsTop),
      };
    }

    if (clientY >= lane.top && clientY <= lane.bottom) {
      return resolveInsideLane(clientY, lane, next, prev, wsTop, wasInsert);
    }
  }

  const last = lanes[lanes.length - 1];
  const prev = lanes.length > 1 ? lanes[lanes.length - 2] : undefined;
  return resolveInsideLane(clientY, last, undefined, prev, wsTop, wasInsert);
}
