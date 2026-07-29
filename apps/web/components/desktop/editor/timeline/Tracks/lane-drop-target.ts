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
  laneId: string | null;
  order: number | null;
};

export type OverlayDragTarget = {
  isInsert: boolean;
  /** Existing overlay lane body; null = main body or insert-only. */
  laneId: string | null;
  /** When isInsert, order for the new overlay lane. */
  insertOrder: number | null;
  indicatorTop: number;
};

export function collectSceneLanes(scope: HTMLElement): VideoLaneHit[] {
  const nodes = scope.querySelectorAll<HTMLElement>("[data-track-lane]");
  const out: VideoLaneHit[] = [];
  for (const el of nodes) {
    const type = el.getAttribute("data-track-type");
    if (type !== "overlay" && type !== "main") continue;
    const r = el.getBoundingClientRect();
    const orderAttr = el.getAttribute("data-lane-order");
    out.push({
      top: r.top,
      bottom: r.bottom,
      type,
      laneId: el.getAttribute("data-lane-id"),
      order: orderAttr != null ? Number.parseInt(orderAttr, 10) : null,
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
    if (lane.type === "overlay" && lane.order != null) {
      return {
        isInsert: true,
        laneId: null,
        insertOrder: lane.order + 1,
        indicatorTop,
      };
    }
    return { isInsert: true, laneId: null, insertOrder: 0, indicatorTop };
  };

  const insertBelow = (): OverlayDragTarget => {
    if (lane.type !== "overlay" || lane.order == null) {
      return { isInsert: false, laneId: null, insertOrder: null, indicatorTop: 0 };
    }
    const indicatorTop =
      next != null ? gapMidInWs(lane, next, wsTop) : lane.bottom - wsTop - 1;
    return {
      isInsert: true,
      laneId: null,
      insertOrder: lane.order,
      indicatorTop,
    };
  };

  const body = (): OverlayDragTarget => {
    if (lane.type === "overlay" && lane.laneId) {
      return {
        isInsert: false,
        laneId: lane.laneId,
        insertOrder: null,
        indicatorTop: 0,
      };
    }
    return { isInsert: false, laneId: null, insertOrder: null, indicatorTop: 0 };
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
  maxOverlayOrder: number,
): OverlayDragTarget | null {
  if (lanes.length === 0) return null;

  const first = lanes[0];
  if (clientY < first.top) {
    return {
      isInsert: true,
      laneId: null,
      insertOrder: maxOverlayOrder + 1,
      indicatorTop: first.top - wsTop - 1,
    };
  }

  for (let i = 0; i < lanes.length; i++) {
    const lane = lanes[i];
    const next = lanes[i + 1];
    const prev = i > 0 ? lanes[i - 1] : undefined;

    // Gap → canonical "below upper" (never flip to "above lower")
    if (next && clientY > lane.bottom && clientY < next.top) {
      if (lane.type === "overlay" && lane.order != null) {
        return {
          isInsert: true,
          laneId: null,
          insertOrder: lane.order,
          indicatorTop: gapMidInWs(lane, next, wsTop),
        };
      }
      return {
        isInsert: true,
        laneId: null,
        insertOrder: 0,
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

/* -------------------------------------------------------------------------- */
/* Audio below main — same insert/body hysteresis as overlay, mirrored zone. */
/* -------------------------------------------------------------------------- */

export type AudioLaneHit = {
  top: number;
  bottom: number;
  type: "audio" | "main";
  laneId: string | null;
  order: number | null;
};

export type AudioDragTarget = {
  isInsert: boolean;
  laneId: string | null;
  insertOrder: number | null;
  indicatorTop: number;
};

/** Collect main + audio lanes for below-main audio DnD (mirror of collectSceneLanes). */
export function collectAudioZoneLanes(scope: HTMLElement): AudioLaneHit[] {
  const nodes = scope.querySelectorAll<HTMLElement>("[data-track-lane]");
  const out: AudioLaneHit[] = [];
  for (const el of nodes) {
    const type = el.getAttribute("data-track-type");
    if (type !== "audio" && type !== "main") continue;
    const r = el.getBoundingClientRect();
    const orderAttr = el.getAttribute("data-lane-order");
    out.push({
      top: r.top,
      bottom: r.bottom,
      type,
      laneId: el.getAttribute("data-lane-id"),
      order: orderAttr != null ? Number.parseInt(orderAttr, 10) : null,
    });
  }
  out.sort((a, b) => a.top - b.top);
  return out;
}

function gapMidAudio(
  upper: AudioLaneHit,
  lower: AudioLaneHit,
  wsTop: number,
): number {
  return (upper.bottom + lower.top) / 2 - wsTop;
}

function insertBelowMain(
  main: AudioLaneHit,
  next: AudioLaneHit | undefined,
  wsTop: number,
): AudioDragTarget {
  const indicatorTop =
    next != null ? gapMidAudio(main, next, wsTop) : main.bottom - wsTop - 1;
  return {
    isInsert: true,
    laneId: null,
    insertOrder: 0,
    indicatorTop,
  };
}

function resolveInsideAudioLane(
  clientY: number,
  lane: AudioLaneHit,
  next: AudioLaneHit | undefined,
  prev: AudioLaneHit | undefined,
  wsTop: number,
  wasInsert: boolean,
): AudioDragTarget {
  const relY = clientY - lane.top;
  const h = Math.max(lane.bottom - lane.top, 1);
  const inBodyClear =
    relY > OVERLAY_EDGE_EXIT_PX && relY < h - OVERLAY_EDGE_EXIT_PX;
  const nearTopEnter = relY <= OVERLAY_EDGE_ENTER_PX;
  const nearBottomEnter = relY >= h - OVERLAY_EDGE_ENTER_PX;

  const insertAbove = (): AudioDragTarget => {
    const indicatorTop =
      prev != null ? gapMidAudio(prev, lane, wsTop) : lane.top - wsTop - 1;
    if (lane.order != null) {
      return {
        isInsert: true,
        laneId: null,
        insertOrder: lane.order,
        indicatorTop,
      };
    }
    return { isInsert: true, laneId: null, insertOrder: 0, indicatorTop };
  };

  const insertBelow = (): AudioDragTarget => {
    if (lane.order == null) {
      return {
        isInsert: true,
        laneId: null,
        insertOrder: 0,
        indicatorTop: lane.bottom - wsTop - 1,
      };
    }
    const indicatorTop =
      next != null ? gapMidAudio(lane, next, wsTop) : lane.bottom - wsTop - 1;
    return {
      isInsert: true,
      laneId: null,
      insertOrder: lane.order + 1,
      indicatorTop,
    };
  };

  const body = (): AudioDragTarget => {
    if (lane.laneId) {
      return {
        isInsert: false,
        laneId: lane.laneId,
        insertOrder: null,
        indicatorTop: 0,
      };
    }
    return {
      isInsert: true,
      laneId: null,
      insertOrder: lane.order ?? 0,
      indicatorTop: lane.top - wsTop,
    };
  };

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
 * Same DnD logic as overlay, but zone is strictly below main.
 * Hover on/above main → cyan insert under main (audio order 0).
 */
export function resolveAudioDragTarget(
  clientY: number,
  lanes: AudioLaneHit[],
  wsTop: number,
  wasInsert: boolean,
  maxAudioOrder: number,
): AudioDragTarget | null {
  if (lanes.length === 0) return null;

  const main = lanes.find((lane) => lane.type === "main");
  const audios = lanes.filter((lane) => lane.type === "audio");

  if (main && clientY <= main.bottom) {
    return insertBelowMain(main, audios[0], wsTop);
  }

  if (audios.length === 0 && main) {
    return insertBelowMain(main, undefined, wsTop);
  }

  for (let i = 0; i < audios.length; i++) {
    const lane = audios[i];
    const next = audios[i + 1];
    const prev = i > 0 ? audios[i - 1] : (main ?? undefined);

    if (next && clientY > lane.bottom && clientY < next.top) {
      return {
        isInsert: true,
        laneId: null,
        insertOrder: (lane.order ?? i) + 1,
        indicatorTop: gapMidAudio(lane, next, wsTop),
      };
    }

    if (clientY >= lane.top && clientY <= lane.bottom) {
      return resolveInsideAudioLane(
        clientY,
        lane,
        next,
        prev,
        wsTop,
        wasInsert,
      );
    }
  }

  const last = audios[audios.length - 1];
  if (last && clientY > last.bottom) {
    return {
      isInsert: true,
      laneId: null,
      insertOrder: Math.max(maxAudioOrder + 1, (last.order ?? 0) + 1),
      indicatorTop: last.bottom - wsTop - 1,
    };
  }

  if (last) {
    const prev =
      audios.length > 1 ? audios[audios.length - 2] : (main ?? undefined);
    return resolveInsideAudioLane(
      clientY,
      last,
      undefined,
      prev,
      wsTop,
      wasInsert,
    );
  }

  return {
    isInsert: true,
    laneId: null,
    insertOrder: 0,
    indicatorTop: 0,
  };
}

