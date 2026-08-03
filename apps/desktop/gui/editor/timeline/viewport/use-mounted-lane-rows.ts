import { useMemo } from "react";
import {
  buildLaneHeightPrefix,
  visibleLaneWindow,
} from "../view-model/visible-lane-window";
import {
  LANE_GAP_PX,
  type TimelineLaneRow,
} from "../lanes/timeline-lane-rows";

export type MountedLaneRow =
  | { kind: "gap"; key: string; height: number }
  | { kind: "lane"; key: string; row: TimelineLaneRow; index: number };

type Args = {
  laneRows: TimelineLaneRow[];
  scrollTop: number;
  trackViewHeight: number;
  topPadding: number;
  contentHeight: number;
  movePinKey: string;
};

export function useMountedLaneRows({
  laneRows,
  scrollTop,
  trackViewHeight,
  topPadding,
  contentHeight,
  movePinKey,
}: Args): {
  laneHeightPrefix: number[];
  mountedRows: MountedLaneRow[];
  mountedOffsetTop: number;
  bottomSpacer: number;
} {
  const laneHeights = useMemo(
    () =>
      laneRows.map((row, i) =>
        row.height + (i < laneRows.length - 1 ? LANE_GAP_PX : 0),
      ),
    [laneRows],
  );

  const laneHeightPrefix = useMemo(
    () => buildLaneHeightPrefix(laneHeights),
    [laneHeights],
  );

  const laneIndexById = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < laneRows.length; i += 1) {
      map.set(laneRows[i]!.id, i);
    }
    return map;
  }, [laneRows]);

  const laneWindow = useMemo(
    () =>
      visibleLaneWindow({
        scrollTop: Math.max(0, scrollTop - topPadding),
        viewHeight: trackViewHeight,
        laneHeights,
        prefixOffsets: laneHeightPrefix,
      }),
    [scrollTop, trackViewHeight, laneHeights, laneHeightPrefix, topPadding],
  );

  /** Window lanes + discrete pin lanes (with gap spacers; no full origin→target expand). */
  const mountedLaneRows = useMemo(() => {
    const indices = new Set<number>();
    const { startIndex, endIndex } = laneWindow;
    if (endIndex >= startIndex && startIndex < laneRows.length) {
      for (let i = startIndex; i <= endIndex; i += 1) indices.add(i);
    }
    if (movePinKey) {
      // Format: origin|lane|member1,member2
      const [origin, lane, members] = movePinKey.split("|");
      const pinIds: string[] = [];
      if (origin) pinIds.push(origin);
      if (lane) pinIds.push(lane);
      if (members) {
        for (const id of members.split(",")) {
          if (id) pinIds.push(id);
        }
      }
      for (const id of pinIds) {
        const idx = laneIndexById.get(id);
        if (idx != null) indices.add(idx);
      }
    }
    const ordered = [...indices].sort((a, b) => a - b);
    const rows: MountedLaneRow[] = [];
    if (ordered.length === 0) {
      return {
        rows,
        offsetTop: topPadding + laneWindow.offsetTop,
      };
    }
    const first = ordered[0]!;
    const offsetTop = topPadding + laneHeightPrefix[first]!;
    rows.push({
      kind: "lane",
      key: laneRows[first]!.id,
      row: laneRows[first]!,
      index: first,
    });
    let prev = first;
    for (let k = 1; k < ordered.length; k += 1) {
      const idx = ordered[k]!;
      const gap = laneHeightPrefix[idx]! - laneHeightPrefix[prev + 1]!;
      if (gap > 0) {
        rows.push({ kind: "gap", key: `gap-${prev}-${idx}`, height: gap });
      }
      rows.push({
        kind: "lane",
        key: laneRows[idx]!.id,
        row: laneRows[idx]!,
        index: idx,
      });
      prev = idx;
    }
    return { rows, offsetTop };
  }, [
    laneRows,
    laneHeightPrefix,
    laneIndexById,
    laneWindow,
    movePinKey,
    topPadding,
  ]);

  const mountedOffsetTop = mountedLaneRows.offsetTop;

  const mountedBlockHeight = mountedLaneRows.rows.reduce((s, r) => {
    if (r.kind === "gap") return s + r.height;
    const trailingGap =
      r.index < laneRows.length - 1 ? LANE_GAP_PX : 0;
    return s + r.row.height + trailingGap;
  }, 0);
  const bottomSpacer = Math.max(
    0,
    contentHeight - mountedOffsetTop - mountedBlockHeight,
  );

  return {
    laneHeightPrefix,
    mountedRows: mountedLaneRows.rows,
    mountedOffsetTop,
    bottomSpacer,
  };
}
