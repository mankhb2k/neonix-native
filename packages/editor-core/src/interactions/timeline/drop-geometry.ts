/**
 * Toán drop geometry thuần — tính xem con trỏ rơi vào lane và thời gian nào.
 * App cung cấp tọa độ đã lấy từ DOM và metadata lane.
 *
 * Chuyển từ apps/desktop/gui/editor/timeline/drop/drop-geometry.ts
 */

import type {
  TimelineLane,
  TimelineTrackKind,
} from "../../timeline/model/timeline-types";

export type { TimelineTrackKind };

export type DropGeometryResult = {
  laneId: string;
  startTime: number;
  track: TimelineTrackKind;
};

export type DropGeometryPureInput = {
  /** Content-space X (giây = x / pps), caller tính trước từ clientX. */
  contentX: number;
  /** Content-space Y tương đối so với đỉnh của lane đầu tiên. */
  contentY: number;
  /** Lanes theo thứ tự hiển thị (overlay → base → audio). Không sort lại. */
  lanes: readonly TimelineLane[];
  /** Resolver chiều cao từng lane (fallback đồng nhất khi bỏ trống). */
  laneHeightFor?: (lane: TimelineLane) => number;
  /** Chiều cao lane fallback đồng nhất. */
  laneHeight: number;
  /** Khoảng gap giữa các lane liên tiếp trong content Y. */
  laneGapPx?: number;
  pixelsPerSecond: number;
  /** Resolve loại track cho một lane. */
  trackForLane: (lane: TimelineLane) => TimelineTrackKind;
};

/**
 * Phiên bản thuần của resolveTimelineDropGeometry — không gọi DOM.
 * Caller tính trước contentX/contentY từ clientX/clientY + scroll rect.
 */
export function resolveDropGeometry(
  input: DropGeometryPureInput,
): DropGeometryResult | null {
  const { contentX, contentY, lanes } = input;
  if (contentY < 0 || lanes.length === 0) return null;

  const heightOf = (lane: TimelineLane) =>
    input.laneHeightFor?.(lane) ?? input.laneHeight;
  const gap = Math.max(0, input.laneGapPx ?? 0);

  let acc = 0;
  let lane = lanes[lanes.length - 1]!;
  for (let i = 0; i < lanes.length; i += 1) {
    const candidate = lanes[i]!;
    const h = Math.max(1, heightOf(candidate));
    if (contentY < acc + h) {
      lane = candidate;
      break;
    }
    acc += h;
    if (i < lanes.length - 1) acc += gap;
  }

  const startTime = Math.max(
    0,
    contentX / Math.max(1e-6, input.pixelsPerSecond),
  );
  return {
    laneId: lane.id,
    startTime,
    track: input.trackForLane(lane),
  };
}
