/**
 * Drill-down group — phân giải đường dẫn breadcrumb thành danh sách layer theo phạm vi.
 * Phản ánh `resolveGroupPath` của clipkit: duyệt `groupPath` (id group, ngoài cùng
 * trước), trả về children của group sâu nhất (hoặc root khi đường dẫn rỗng),
 * các group đã đi qua (cho breadcrumb) và offset thời gian tích lũy để đưa
 * thời gian của con về đúng thời gian comp.
 */

import type { MotionLayer } from "@motionvideo/motion-protocol";
import type { GroupLayer } from "./group";

export interface GroupPathResolution {
  /** Danh sách layer theo phạm vi: children của group sâu nhất đã vào, hoặc danh sách root. */
  layers: MotionLayer[];
  /** Các group đã đi qua trên đường dẫn (dành cho breadcrumb). */
  crumbs: GroupLayer[];
  /** `timing.start` tích lũy của các group đã vào. */
  timeOffset: number;
}

export function resolveGroupPath(
  rootLayers: readonly MotionLayer[],
  groupPath: readonly string[],
): GroupPathResolution {
  let layers: readonly MotionLayer[] = rootLayers;
  const crumbs: GroupLayer[] = [];
  let timeOffset = 0;

  for (const id of groupPath) {
    const group = layers.find(
      (l): l is GroupLayer => l.id === id && l.type === "group",
    );
    if (!group) break; // id cũ — dừng sớm
    crumbs.push(group);
    timeOffset += group.timing.start;
    layers = group.children;
  }

  return { layers: [...layers], crumbs, timeOffset };
}
