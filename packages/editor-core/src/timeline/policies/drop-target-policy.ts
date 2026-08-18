/**
 * Pure lane drag targeting cho timeline.
 * Dùng chung hit-test + hysteresis insert-line cho visual (trên base) và audio (dưới base).
 * Không DOM — geometry rect do caller / DomGeometryAdapter cung cấp.
 */

/* ========================================================================== */
/* 1. HYSTERESIS CONFIG & CONSTANT                                             */
/* ========================================================================== */

/** px dưới border trên TimeRuler — ngưỡng chung cho card↔cyan (vào & ra) */
export const CYAN_MODE_BELOW_RULER_TOP_PX = 16;
/** Trần band insert khi lane đủ cao. Compact overlay/audio (≈28px) clamp nhỏ hơn. */
export const LANE_INSERT_ENTER_PX = 12;
/** Trần hysteresis thoát insert. Phải < nửa chiều cao lane, nếu không body rỗng. */
export const LANE_INSERT_EXIT_PX = 16;

/**
 * Insert bands scale with lane height so compact rows stay droppable.
 * A 28px overlay with ENTER=12/EXIT=16 would leave a 4px body, and hysteresis
 * `exit*2 >= h` can never land on the lane after crossing a gap.
 */
export function insertEdgeBands(heightPx: number): {
  enter: number;
  exit: number;
} {
  const h = Math.max(heightPx, 1);
  const enter = Math.min(
    LANE_INSERT_ENTER_PX,
    Math.max(0, Math.floor(h * 0.15)),
  );
  let exit = Math.min(
    LANE_INSERT_EXIT_PX,
    Math.max(enter, Math.floor(h * 0.25)),
  );
  const maxExit = Math.max(0, Math.floor((h - 1) / 2) - 1);
  exit = Math.min(exit, maxExit);
  return { enter: Math.min(enter, exit), exit };
}
/** Bỏ qua setState indicator khi Y gần như không đổi (giảm re-render dragover) */
export const INDICATOR_TOP_EPS_PX = 0.5;

/** @deprecated Dùng LANE_INSERT_ENTER_PX thay thế. */
export const OVERLAY_EDGE_ENTER_PX = LANE_INSERT_ENTER_PX;
/** @deprecated Dùng LANE_INSERT_EXIT_PX thay thế. */
export const OVERLAY_EDGE_EXIT_PX = LANE_INSERT_EXIT_PX;

/* ========================================================================== */
/* 2. HIT TYPE & POLICY                                                       */
/* ========================================================================== */

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
  /** Hướng mà lane order tăng dần xa khỏi Main. */
  outwardDirection: "up" | "down";
  /** Visual may land on base body; audio never targets base as a clip body. */
  allowBaseTarget: boolean;
};

export const visualDropPolicy: LaneDropPolicy = {
  family: "visual",
  outwardDirection: "up",
  allowBaseTarget: true,
};

export const audioDropPolicy: LaneDropPolicy = {
  family: "audio",
  outwardDirection: "down",
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

/* ========================================================================== */
/* 3. HIT CONVERTERS                                                         */
/* ========================================================================== */

/** Map scene hits into shared LaneHit (visual family). */
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

/** Map audio-zone hits into shared LaneHit (audio family). */
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

/* ========================================================================== */
/* 4. CORE DROP TARGET RESOLUTION MATH                                       */
/* ========================================================================== */

function gapMid(upper: LaneHit, lower: LaneHit, wsTop: number): number {
  return (upper.bottom + lower.top) / 2 - wsTop;
}

function insertOrderAtEdge(
  lane: LaneHit,
  edge: "top" | "bottom",
  policy: LaneDropPolicy,
): number {
  if (lane.order == null) return 0;
  const isOutwardEdge =
    policy.outwardDirection === "up" ? edge === "top" : edge === "bottom";
  return isOutwardEdge ? lane.order + 1 : lane.order;
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
  const { enter, exit } = insertEdgeBands(h);
  const inBodyClear = relY > exit && relY < h - exit;
  const nearTopEnter = relY <= enter;
  const nearBottomEnter = relY >= h - enter;

  const insertAtEdge = (edge: "top" | "bottom"): TimelineDropTarget => {
    const neighbor = edge === "top" ? prev : next;
    const indicatorTop =
      neighbor != null
        ? edge === "top"
          ? gapMid(neighbor, lane, wsTop)
          : gapMid(lane, neighbor, wsTop)
        : (edge === "top" ? lane.top : lane.bottom) - wsTop - 1;
    return {
      family,
      isInsert: true,
      laneId: null,
      insertOrder:
        lane.role === "base" ? 0 : insertOrderAtEdge(lane, edge, policy),
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

  // Visual base: only top-edge insert with narrow band (4px).
  // Symmetric enter/exit — once pointer moves >4px from top, exit insert mode.
  // Never bottom-edge insert. Inside the body → target base.
  if (lane.role === "base") {
    const outwardEdge = policy.outwardDirection === "up" ? "top" : "bottom";
    if (!policy.allowBaseTarget) return insertAtEdge(outwardEdge);
    const baseBandPx = 4;
    const distanceFromOutwardEdge = outwardEdge === "top" ? relY : h - relY;
    if (distanceFromOutwardEdge <= baseBandPx) {
      return insertAtEdge(outwardEdge);
    }
    return body();
  }

  if (!wasInsert) {
    if (nearTopEnter) return insertAtEdge("top");
    if (nearBottomEnter) return insertAtEdge("bottom");
    return body();
  }
  if (inBodyClear) return body();
  if (relY < h / 2) return insertAtEdge("top");
  return insertAtEdge("bottom");
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
  return resolveStackZone(
    clientY,
    lanes,
    wsTop,
    wasInsert,
    maxFamilyOrder,
    policy,
  );
}

function isStackLane(lane: LaneHit, policy: LaneDropPolicy): boolean {
  if (lane.role === "placeholder") return true;
  return policy.family === "visual"
    ? lane.role === "overlay"
    : lane.role === "audio";
}

function targetAtBase(
  base: LaneHit,
  stackLanes: LaneHit[],
  wsTop: number,
  policy: LaneDropPolicy,
): TimelineDropTarget {
  if (policy.allowBaseTarget) {
    return {
      family: policy.family,
      isInsert: false,
      laneId: null,
      insertOrder: null,
      indicatorTop: 0,
      overBaseBody: true,
    };
  }
  const closest = [...stackLanes].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  )[0];
  const indicatorTop = closest
    ? policy.outwardDirection === "up"
      ? gapMid(closest, base, wsTop)
      : gapMid(base, closest, wsTop)
    : (policy.outwardDirection === "up" ? base.top : base.bottom) - wsTop - 1;
  return {
    family: policy.family,
    isInsert: true,
    laneId: null,
    insertOrder: 0,
    indicatorTop,
  };
}

function targetBeyondOutermost(
  base: LaneHit | undefined,
  stackLanes: LaneHit[],
  wsTop: number,
  maxFamilyOrder: number,
  policy: LaneDropPolicy,
): TimelineDropTarget | null {
  const outermost = [...stackLanes].sort(
    (a, b) => (b.order ?? 0) - (a.order ?? 0),
  )[0];
  const boundary = outermost ?? base;
  if (!boundary) return null;
  return {
    family: policy.family,
    isInsert: true,
    laneId: null,
    insertOrder: maxFamilyOrder + 1,
    indicatorTop:
      (policy.outwardDirection === "up" ? boundary.top : boundary.bottom) -
      wsTop -
      1,
  };
}

/**
 * One resolver for both lane stacks. `order` is always distance from Main;
 * overlay grows upward and audio grows downward.
 */
function resolveStackZone(
  clientY: number,
  lanes: LaneHit[],
  wsTop: number,
  wasInsert: boolean,
  maxFamilyOrder: number,
  policy: LaneDropPolicy,
): TimelineDropTarget | null {
  const ordered = lanes
    .filter((lane) => lane.role === "base" || isStackLane(lane, policy))
    .sort((a, b) => a.top - b.top);
  if (ordered.length === 0) return null;

  const base = ordered.find((lane) => lane.role === "base");
  const stackLanes = ordered.filter((lane) => isStackLane(lane, policy));
  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  if (clientY < first.top) {
    if (policy.outwardDirection === "up") {
      return targetBeyondOutermost(
        base,
        stackLanes,
        wsTop,
        maxFamilyOrder,
        policy,
      );
    }
    return base ? targetAtBase(base, stackLanes, wsTop, policy) : null;
  }

  if (clientY > last.bottom) {
    if (policy.outwardDirection === "down") {
      return targetBeyondOutermost(
        base,
        stackLanes,
        wsTop,
        maxFamilyOrder,
        policy,
      );
    }
    return base ? targetAtBase(base, stackLanes, wsTop, policy) : null;
  }

  for (let i = 0; i < ordered.length; i++) {
    const lane = ordered[i];
    const next = ordered[i + 1];
    const prev = i > 0 ? ordered[i - 1] : undefined;

    if (next && clientY > lane.bottom && clientY < next.top) {
      return {
        family: policy.family,
        isInsert: true,
        laneId: null,
        insertOrder:
          lane.role === "base" || next.role === "base"
            ? 0
            : insertOrderAtEdge(lane, "bottom", policy),
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
  return null;
}

/* ========================================================================== */
/* 5. LEGACY WRAPPERS                                                        */
/* ========================================================================== */

function toLegacyTarget(target: TimelineDropTarget): OverlayDragTarget {
  return {
    isInsert: target.isInsert,
    laneId: target.laneId,
    insertOrder: target.insertOrder,
    indicatorTop: target.indicatorTop,
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
