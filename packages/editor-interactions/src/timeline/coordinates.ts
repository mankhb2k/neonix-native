import { TIMELINE_PLAYHEAD_GUTTER_PX as CORE_PLAYHEAD_GUTTER_PX } from "@motionvideo/editor-core";

/** Gutter playhead giữa nhãn và nội dung track (px). Nguồn duy nhất: editor-core. */
export const TIMELINE_PLAYHEAD_GUTTER_PX = CORE_PLAYHEAD_GUTTER_PX;

/**
 * Metrics viewport đã chuẩn hóa cho phép toán tọa độ timeline (PR-2 sẽ thay
 * hoàn toàn các helper dựa trên HTMLElement bằng các trường này).
 */
export type TimelineViewportMetrics = {
  clientLeft: number;
  clientTop: number;
  clientWidth: number;
  clientHeight: number;
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
  tracksOriginX: number;
};
