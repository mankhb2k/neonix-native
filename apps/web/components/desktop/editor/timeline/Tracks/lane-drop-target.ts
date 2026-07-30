/**
 * Pure lane drag targeting for the timeline.
 * Shared hit-test + insert-line hysteresis for visual (above base) and audio (below base).
 */

/** px below TimeRuler top border — single threshold for card↔cyan (enter & exit) */
export const CYAN_MODE_BELOW_RULER_TOP_PX = 16;
/** Enter insert-line mode only when within this many px of a lane edge */
export const OVERLAY_EDGE_ENTER_PX = 2;
/** Exit insert-line only when this far into the lane body (hysteresis) */
export const OVERLAY_EDGE_EXIT_PX = 10;
/** Skip indicator setState when Y barely moved (cuts dragover re-renders) */
export const INDICATOR_TOP_EPS_PX = 0.5;

export type LaneHit = {
  laneId: string | null;
  family: "visual" | "audio";
  role: "base" | "overlay" | "audio" | "placeholder";
  order: number | null;
  top: number;
  bottom: number;
};

export type TimelineDropTarget = {
  family: "visual" | "audio";
  isInsert: boolean;
  laneId: string | null;
  insertOrder: number | null;
  indicatorTop: number;
  overBaseBody?: boolean;
};

export type LaneDropPolicy = {
  family: "visual" | "audio";
  /** Visual may land on base body; audio never targets base as a clip body. */
  allowBaseTarget: boolean;
};

export const visualDropPolicy: LaneDropPolicy = {
  family: "visual",
  allowBaseTarget: true,
};

export const audioDropPolicy: LaneDropPolicy = {
  family: "audio",
  allowBaseTarget: false,
};

/** @deprecated Prefer LaneHit — kept for call-site compatibility. */
export type VideoLaneHit = {
  top: number;
  bottom: number;
  type: "overlay" | "main";
  laneId: string | null;
  order: number | null;
};

/** @deprecated Prefer TimelineDropTarget. */
export type OverlayDragTarget = {
  isInsert: boolean;
  laneId: string | null;
  insertOrder: number | null;
  indicatorTop: number;
};

/** @deprecated Prefer LaneHit. */
export type AudioLaneHit = {
  top: number;
  bottom: number;
  type: "audio" | "main";
  laneId: string | null;
  order: number | null;
};

/** @deprecated Prefer TimelineDropTarget. */
export type AudioDragTarget = {
  isInsert: boolean;
  laneId: string | null;
  insertOrder: number | null;
  indicatorTop: number;
};

/** Map DOM scene hits into shared LaneHit (visual family). */
export function videoHitToLane(hit: VideoLaneHit): LaneHit {
  if (hit.type === "main") {
    return {
      laneId: hit.laneId,
      family: "visual",
      role: "base",
      order: hit.order,
      top: hit.top,
      bottom: hit.bottom,
    };
  }
  return {
    laneId: hit.laneId,
    family: "visual",
    role: hit.laneId ? "overlay" : "placeholder",
    order: hit.order,
    top: hit.top,
    bottom: hit.bottom,
  };
}

/** Map DOM audio-zone hits into shared LaneHit (audio family). */
export function audioHitToLane(hit: AudioLaneHit): LaneHit {
  if (hit.type === "main") {
    return {
      laneId: hit.laneId,
      family: "audio",
      role: "base",
      order: hit.order,
      top: hit.top,
      bottom: hit.bottom,
    };
  }
  return {
    laneId: hit.laneId,
    family: "audio",
    role: hit.laneId ? "audio" : "placeholder",
    order: hit.order,
    top: hit.top,
    bottom: hit.bottom,
  };
}

function toLegacyTarget(target: TimelineDropTarget): OverlayDragTarget {
  return {
    isInsert: target.isInsert,
    laneId: target.laneId,
    insertOrder: target.insertOrder,
    indicatorTop: target.indicatorTop,
  };
}

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

/** Cache lane rects relative to workspace — invalidate on scroll/resize. */
export type RelativeLaneHit = {
  relTop: number;
  relBottom: number;
  type: "overlay" | "main";
  laneId: string | null;
  order: number | null;
};

export function cacheSceneLanesRelative(
  scope: HTMLElement,
  wsTop: number,
): RelativeLaneHit[] {
  return collectSceneLanes(scope).map((lane) => ({
    relTop: lane.top - wsTop,
    relBottom: lane.bottom - wsTop,
    type: lane.type,
    laneId: lane.laneId,
    order: lane.order,
  }));
}

export function absoluteSceneLanes(
  cached: RelativeLaneHit[],
  wsTop: number,
): VideoLaneHit[] {
  return cached.map((lane) => ({
    top: lane.relTop + wsTop,
    bottom: lane.relBottom + wsTop,
    type: lane.type,
    laneId: lane.laneId,
    order: lane.order,
  }));
}

function gapMid(upper: LaneHit, lower: LaneHit, wsTop: number): number {
  return (upper.bottom + lower.top) / 2 - wsTop;
}

function insertOrderAbove(lane: LaneHit, policy: LaneDropPolicy): number {
  if (policy.family === "visual") {
    if (lane.role === "overlay" && lane.order != null) return lane.order + 1;
    return 0;
  }
  if (lane.order != null) return lane.order;
  return 0;
}

function insertOrderBelow(lane: LaneHit, policy: LaneDropPolicy): number | null {
  if (policy.family === "visual") {
    if (lane.role !== "overlay" || lane.order == null) return null;
    return lane.order;
  }
  if (lane.order == null) return 0;
  return lane.order + 1;
}

function resolveInsideLane(
  clientY: number,
  lane: LaneHit,
  next: LaneHit | undefined,
  prev: LaneHit | undefined,
  wsTop: number,
  wasInsert: boolean,
  policy: LaneDropPolicy,
): TimelineDropTarget {
  const family = policy.family;
  const relY = clientY - lane.top;
  const h = Math.max(lane.bottom - lane.top, 1);
  const inBodyClear =
    relY > OVERLAY_EDGE_EXIT_PX && relY < h - OVERLAY_EDGE_EXIT_PX;
  const nearTopEnter = relY <= OVERLAY_EDGE_ENTER_PX;
  const nearBottomEnter = relY >= h - OVERLAY_EDGE_ENTER_PX;

  const insertAbove = (): TimelineDropTarget => {
    const indicatorTop =
      prev != null ? gapMid(prev, lane, wsTop) : lane.top - wsTop - 1;
    return {
      family,
      isInsert: true,
      laneId: null,
      insertOrder: insertOrderAbove(lane, policy),
      indicatorTop,
    };
  };

  const insertBelow = (): TimelineDropTarget => {
    const order = insertOrderBelow(lane, policy);
    if (order == null) {
      return {
        family,
        isInsert: false,
        laneId: null,
        insertOrder: null,
        indicatorTop: 0,
        overBaseBody: false,
      };
    }
    const indicatorTop =
      next != null ? gapMid(lane, next, wsTop) : lane.bottom - wsTop - 1;
    return {
      family,
      isInsert: true,
      laneId: null,
      insertOrder: order,
      indicatorTop,
    };
  };

  const body = (): TimelineDropTarget => {
    if (lane.role === "base") {
      return {
        family,
        isInsert: false,
        laneId: null,
        insertOrder: null,
        indicatorTop: 0,
        overBaseBody: policy.allowBaseTarget,
      };
    }
    if (lane.laneId) {
      return {
        family,
        isInsert: false,
        laneId: lane.laneId,
        insertOrder: null,
        indicatorTop: 0,
      };
    }
    // Virtual empty placeholder (no laneId) → create lane on drop.
    return {
      family,
      isInsert: true,
      laneId: null,
      insertOrder: lane.order ?? 0,
      indicatorTop: lane.top - wsTop,
    };
  };

  // Visual base: only top-edge insert; never bottom-edge insert.
  if (family === "visual" && lane.role === "base") {
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
 * Shared rect-based hit test. Gaps between lanes map to "insert below upper"
 * so the cyan line target does not flip each pixel.
 */
export function resolveLaneDropTarget(
  clientY: number,
  lanes: LaneHit[],
  wsTop: number,
  wasInsert: boolean,
  maxFamilyOrder: number,
  policy: LaneDropPolicy,
): TimelineDropTarget | null {
  if (lanes.length === 0) return null;

  if (policy.family === "audio") {
    return resolveAudioZone(clientY, lanes, wsTop, wasInsert, maxFamilyOrder);
  }
  return resolveVisualZone(clientY, lanes, wsTop, wasInsert, maxFamilyOrder);
}

function resolveVisualZone(
  clientY: number,
  lanes: LaneHit[],
  wsTop: number,
  wasInsert: boolean,
  maxOverlayOrder: number,
): TimelineDropTarget | null {
  const policy = visualDropPolicy;
  const first = lanes[0];
  if (clientY < first.top) {
    return {
      family: "visual",
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

    if (next && clientY > lane.bottom && clientY < next.top) {
      if (lane.role === "overlay" && lane.order != null) {
        return {
          family: "visual",
          isInsert: true,
          laneId: null,
          insertOrder: lane.order,
          indicatorTop: gapMid(lane, next, wsTop),
        };
      }
      return {
        family: "visual",
        isInsert: true,
        laneId: null,
        insertOrder: 0,
        indicatorTop: gapMid(lane, next, wsTop),
      };
    }

    if (clientY >= lane.top && clientY <= lane.bottom) {
      return resolveInsideLane(
        clientY,
        lane,
        next,
        prev,
        wsTop,
        wasInsert,
        policy,
      );
    }
  }

  const last = lanes[lanes.length - 1];
  const prev = lanes.length > 1 ? lanes[lanes.length - 2] : undefined;
  return resolveInsideLane(
    clientY,
    last,
    undefined,
    prev,
    wsTop,
    wasInsert,
    policy,
  );
}

function insertBelowBase(
  base: LaneHit,
  next: LaneHit | undefined,
  wsTop: number,
): TimelineDropTarget {
  const indicatorTop =
    next != null ? gapMid(base, next, wsTop) : base.bottom - wsTop - 1;
  return {
    family: "audio",
    isInsert: true,
    laneId: null,
    insertOrder: 0,
    indicatorTop,
  };
}

function resolveAudioZone(
  clientY: number,
  lanes: LaneHit[],
  wsTop: number,
  wasInsert: boolean,
  maxAudioOrder: number,
): TimelineDropTarget | null {
  const policy = audioDropPolicy;
  const base = lanes.find((lane) => lane.role === "base");
  const audios = lanes.filter(
    (lane) => lane.role === "audio" || lane.role === "placeholder",
  );

  if (base && clientY <= base.bottom) {
    return insertBelowBase(base, audios[0], wsTop);
  }

  if (audios.length === 0 && base) {
    return insertBelowBase(base, undefined, wsTop);
  }

  for (let i = 0; i < audios.length; i++) {
    const lane = audios[i];
    const next = audios[i + 1];
    const prev = i > 0 ? audios[i - 1] : (base ?? undefined);

    if (next && clientY > lane.bottom && clientY < next.top) {
      return {
        family: "audio",
        isInsert: true,
        laneId: null,
        insertOrder: (lane.order ?? i) + 1,
        indicatorTop: gapMid(lane, next, wsTop),
      };
    }

    if (clientY >= lane.top && clientY <= lane.bottom) {
      return resolveInsideLane(
        clientY,
        lane,
        next,
        prev,
        wsTop,
        wasInsert,
        policy,
      );
    }
  }

  const last = audios[audios.length - 1];
  if (last && clientY > last.bottom) {
    return {
      family: "audio",
      isInsert: true,
      laneId: null,
      insertOrder: Math.max(maxAudioOrder + 1, (last.order ?? 0) + 1),
      indicatorTop: last.bottom - wsTop - 1,
    };
  }

  if (last) {
    const prev =
      audios.length > 1 ? audios[audios.length - 2] : (base ?? undefined);
    return resolveInsideLane(
      clientY,
      last,
      undefined,
      prev,
      wsTop,
      wasInsert,
      policy,
    );
  }

  return {
    family: "audio",
    isInsert: true,
    laneId: null,
    insertOrder: 0,
    indicatorTop: 0,
  };
}

/**
 * @deprecated Prefer {@link resolveLaneDropTarget} with {@link visualDropPolicy}.
 */
export function resolveOverlayDragTarget(
  clientY: number,
  lanes: VideoLaneHit[],
  wsTop: number,
  wasInsert: boolean,
  maxOverlayOrder: number,
): OverlayDragTarget | null {
  const target = resolveLaneDropTarget(
    clientY,
    lanes.map(videoHitToLane),
    wsTop,
    wasInsert,
    maxOverlayOrder,
    visualDropPolicy,
  );
  return target ? toLegacyTarget(target) : null;
}

/* -------------------------------------------------------------------------- */
/* Audio collectors — zone below base.                                        */
/* -------------------------------------------------------------------------- */

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

export type RelativeAudioLaneHit = {
  relTop: number;
  relBottom: number;
  type: "audio" | "main";
  laneId: string | null;
  order: number | null;
};

export function cacheAudioLanesRelative(
  scope: HTMLElement,
  wsTop: number,
): RelativeAudioLaneHit[] {
  return collectAudioZoneLanes(scope).map((lane) => ({
    relTop: lane.top - wsTop,
    relBottom: lane.bottom - wsTop,
    type: lane.type,
    laneId: lane.laneId,
    order: lane.order,
  }));
}

export function absoluteAudioLanes(
  cached: RelativeAudioLaneHit[],
  wsTop: number,
): AudioLaneHit[] {
  return cached.map((lane) => ({
    top: lane.relTop + wsTop,
    bottom: lane.relBottom + wsTop,
    type: lane.type,
    laneId: lane.laneId,
    order: lane.order,
  }));
}

/**
 * @deprecated Prefer {@link resolveLaneDropTarget} with {@link audioDropPolicy}.
 */
export function resolveAudioDragTarget(
  clientY: number,
  lanes: AudioLaneHit[],
  wsTop: number,
  wasInsert: boolean,
  maxAudioOrder: number,
): AudioDragTarget | null {
  const target = resolveLaneDropTarget(
    clientY,
    lanes.map(audioHitToLane),
    wsTop,
    wasInsert,
    maxAudioOrder,
    audioDropPolicy,
  );
  return target ? toLegacyTarget(target) : null;
}
