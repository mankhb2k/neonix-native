/**
 * Group — wrap selected TOP-LEVEL layers into a new group layer, the inverse
 * of ungroup. Mirrors clipkit's coordinate-identity group design (lib/group.ts):
 * the group takes an identity transform so children render identically, with a
 * time offset = the earliest child's start and each child's timing made local.
 *
 * Protocol V1 group model:
 *   - Only `type: "group"` may carry `children` (nested, source of truth).
 *   - Child `timing` is LOCAL to the group (schema enforces child.end ≤ parent.duration).
 *   - Child `parentLayerId` must equal the group id.
 *   - Root layers have `parentLayerId: null`.
 */

import {
  type MotionLayer,
  type MotionTransform,
} from "@motionvideo/motion-protocol";

export type { MotionLayer, MotionTransform };

/** V1 group layer — the union member that carries nested `children`. */
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
 * True when ungrouping this group cannot move pixels: identity transform,
 * fully visible, no compositing. (Time offset is always baked losslessly, so
 * it is not gated here — unlike clipkit, whose children keep absolute times.)
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
    layer.appearance.visible !== false && layer.appearance.opacity === 100;
  return identity && appearance && layer.compositing === undefined;
}

/**
 * True when the layer is a group with children the editor can drill into.
 * Primitive roots (shape/text/video/image) are not groups.
 */
export function canDrillIntoGroup(layer: MotionLayer | undefined): boolean {
  return Boolean(
    layer && layer.type === "group" && layer.children.length > 0,
  );
}

/** Library used to wrap a primitive in a scene group whose child id is `node_*`. */
function isGeneratedNodeId(id: string): boolean {
  return /^node[_-]/.test(id);
}

/**
 * Promote library scene-wrappers (group → one `node_*` primitive) to a
 * flat layer. Keeps the group id so timeline clips still bind. Real groups
 * (Hero + Title, user Group) are left intact.
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
    isGeneratedNodeId(only.id)
  ) {
    return {
      ...only,
      id: layer.id,
      name: layer.name ?? only.name,
      parentLayerId: layer.parentLayerId,
      zIndex: layer.zIndex,
      timing: { ...layer.timing },
    } as MotionLayer;
  }
  return { ...layer, children };
}

/**
 * Wrap the selected TOP-LEVEL layers into a new coordinate-identity group.
 *
 * - The group takes an identity transform (children keep absolute coords).
 * - `timing.start` = earliest child start; children made local to it.
 * - `timing.duration` spans the children.
 * - `zIndex` = front-most child's zIndex (paint position preserved).
 *
 * Returns null if fewer than two of `ids` are root layers.
 */
export function groupLayers(
  layers: readonly MotionLayer[],
  ids: readonly string[],
  newId: string,
): GroupResult | null {
  const idSet = new Set(ids);
  const selected = layers.filter((l) => idSet.has(l.id));
  if (selected.length < 2) return null;

  // Siblings share a parent — the new group inherits it, so grouping also
  // works inside a drilled-in group (scoped array), not just at the root.
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
    name: "Group",
    parentLayerId: groupParent,
    zIndex: Math.max(...selected.map((l) => l.zIndex)),
    frame: { width: 0, height: 0 },
    transform: IDENTITY_TRANSFORM,
    appearance: { visible: true, opacity: 100 },
    timing: { start: round3(groupStart), duration: round3(maxEnd) },
    children,
  };

  // Insert at the position of the first selected element (clipkit parity).
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
 * Lift a top-level group's children back to the root, in place. Bakes the
 * group's time offset onto each child and resets `parentLayerId` to null.
 * Returns null if `groupId` is not a top-level group.
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
