/**
 * Group — gói các layer CẤP GỐC được chọn thành một group layer mới, ngược lại
 * của ungroup. Phản ánh thiết kế group dạng coordinate-identity của clipkit:
 * group nhận transform đơn vị để các con hiển thị giống hệt, với offset thời gian
 * bằng start của con sớm nhất và timing mỗi con được chuyển về local.
 *
 * Mô hình group V1:
 *   - Chỉ `type: "group"` mới mang `children` (lồng nhau, nguồn dữ liệu chính).
 *   - `timing` của con là LOCAL trong group (schema ép buộc child.end ≤ parent.duration).
 *   - `parentLayerId` của con phải bằng id của group.
 *   - Layer gốc có `parentLayerId: null`.
 */

import {
  type MotionLayer,
  type MotionTransform,
} from "@motionvideo/motion-protocol";

export type { MotionLayer, MotionTransform };

/** Group layer V1 — thành viên union mang `children` lồng nhau. */
export type GroupLayer = Extract<MotionLayer, { type: "group" }>;

export interface GroupResult {
  layers: MotionLayer[];
  groupId: string;
}

export interface UngroupResult {
  layers: MotionLayer[];
  liftedIds: string[];
}

const numberOr = (v: unknown, d: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : d;
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

const IDENTITY_TRANSFORM: MotionTransform = {
  translate: { x: 0, y: 0 },
  scale: { x: 1, y: 1 },
  rotate: { z: 0 },
  skew: { x: 0, y: 0 },
  origin: { x: 0.5, y: 0.5 },
  depth: 0,
};

/**
 * Trả về true khi việc ungroup group này không làm dịch chuyển pixel: transform
 * đơn vị, hiển thị đầy đủ, không có compositing. (Offset thời gian luôn được nướng
 * không mất mát, nên không bị chặn ở đây — khác clipkit, nơi con giữ thời gian tuyệt đối.)
 */
export function isIdentityGroup(layer: MotionLayer): layer is GroupLayer {
  if (layer.type !== "group") return false;
  const t = layer.transform;
  const identity =
    t.translate.x === 0 &&
    t.translate.y === 0 &&
    t.rotate.z === 0 &&
    t.scale.x === 1 &&
    t.scale.y === 1 &&
    t.skew.x === 0 &&
    t.skew.y === 0 &&
    t.depth === 0;
  const appearance =
    ("opacity" in layer ? (layer.opacity ?? 100) : 100) === 100;
  return identity && appearance && layer.compositing === undefined;
}

/**
 * Trả về true khi layer là group có children mà editor có thể drill vào.
 * Root nguyên thủy (shape/text/video/image) không phải group.
 */
export function canDrillIntoGroup(layer: MotionLayer | undefined): boolean {
  return Boolean(layer && layer.type === "group" && layer.children.length > 0);
}

/** Nhận diện id layer do library sinh ra (có tiền tố `node_`). */
function isGeneratedLayerId(id: string): boolean {
  return /^node[_-]/.test(id);
}

/**
 * Nâng cấp scene-wrapper của library (group → một primitive `node_*`) thành
 * layer phẳng. Giữ id của group để timeline clips vẫn liên kết đúng. Group thật
 * (Hero + Title, Group của người dùng) được giữ nguyên.
 */
export function unwrapLibrarySceneWrappers(
  layers: readonly MotionLayer[],
): MotionLayer[] {
  return layers.map(unwrapLibrarySceneWrapper);
}

function unwrapLibrarySceneWrapper(layer: MotionLayer): MotionLayer {
  if (layer.type !== "group") return layer;
  const children = layer.children.map(unwrapLibrarySceneWrapper);
  const only = children[0];
  if (
    children.length === 1 &&
    only &&
    only.type !== "group" &&
    isGeneratedLayerId(only.id)
  ) {
    return {
      ...only,
      id: layer.id,
      parentLayerId: layer.parentLayerId,
      zIndex: layer.zIndex,
      timing: { ...layer.timing },
    } as MotionLayer;
  }
  return { ...layer, children };
}

/**
 * Gói các layer CẤP GỐC được chọn thành một group coordinate-identity mới.
 *
 * - Group nhận transform đơn vị (các con giữ tọa độ tuyệt đối).
 * - `timing.start` = start của con sớm nhất; các con được chuyển về local theo nó.
 * - `timing.duration` bao trùm các con.
 * - `zIndex` = zIndex của con trên cùng (giữ vị trí sơn).
 *
 * Trả về null nếu có ít hơn hai trong `ids` là layer gốc.
 */
export function groupLayers(
  layers: readonly MotionLayer[],
  ids: readonly string[],
  newId: string,
): GroupResult | null {
  const idSet = new Set(ids);
  const selected = layers.filter((l) => idSet.has(l.id));
  if (selected.length < 2) return null;

  // Các anh em chia sẻ chung parent — group mới kế thừa nó, nên việc gom nhóm
  // cũng hoạt động bên trong một group đã drill vào (mảng theo phạm vi), không chỉ ở root.
  const groupParent = selected[0]!.parentLayerId;
  const groupStart = Math.min(...selected.map((l) => l.timing.start));

  const children = selected.map((l) => ({
    ...l,
    parentLayerId: newId,
    timing: {
      start: round3(l.timing.start - groupStart),
      duration: l.timing.duration,
    },
  })) as MotionLayer[];

  const maxEnd = Math.max(
    ...children.map((c) => c.timing.start + c.timing.duration),
  );

  const group: GroupLayer = {
    id: newId,
    type: "group",
    parentLayerId: groupParent,
    zIndex: Math.max(...selected.map((l) => l.zIndex)),
    frame: { width: 0, height: 0 },
    transform: IDENTITY_TRANSFORM,
    opacity: 100,
    timing: { start: round3(groupStart), duration: round3(maxEnd) },
    children,
  };

  // Chèn vào vị trí của phần tử đầu tiên được chọn (đồng bộ với clipkit).
  const firstId = selected[0]!.id;
  const firstIdx = layers.findIndex((l) => l.id === firstId);
  const out: MotionLayer[] = [];
  layers.forEach((l, i) => {
    if (idSet.has(l.id)) {
      if (i === firstIdx) out.push(group);
    } else {
      out.push(l);
    }
  });

  return { layers: out, groupId: newId };
}

/**
 * Nâng children của group cấp gốc trở lại root, tại chỗ. Nướng offset thời gian
 * của group vào từng con và đặt lại `parentLayerId` về null.
 * Trả về null nếu `groupId` không phải group cấp gốc.
 */
export function ungroupLayers(
  layers: readonly MotionLayer[],
  groupId: string,
): UngroupResult | null {
  const idx = layers.findIndex((l) => l.id === groupId && l.type === "group");
  if (idx < 0) return null;
  const group = layers[idx] as GroupLayer;
  const groupStart = numberOr(group.timing.start, 0);

  const liftedIds: string[] = [];
  const lifted: MotionLayer[] = group.children.map((child) => {
    liftedIds.push(child.id);
    return {
      ...child,
      parentLayerId: group.parentLayerId,
      timing: {
        start: round3(groupStart + numberOr(child.timing.start, 0)),
        duration: child.timing.duration,
      },
    } as MotionLayer;
  });

  return {
    layers: [...layers.slice(0, idx), ...lifted, ...layers.slice(idx + 1)],
    liftedIds,
  };
}
