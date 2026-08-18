/**
 * Cây phân cấp layer cho panel Layers kiểu Figma.
 * Document vẫn phẳng `project.layers` + parentLayerId; đây chỉ là view-model.
 *
 * Di chuyển từ apps/desktop/gui/editor/timeline/layer-mode/build-layer-tree.ts
 */

import type { MotionLayer } from "@motionvideo/motion-protocol";

export type LayerTreeNode = {
  id: string;
  name: string;
  type: string;
  depth: number;
  zIndex: number;
  declarationIndex: number;
  visible: boolean;
  parentLayerId: string | null;
  children: LayerTreeNode[];
};

export type LayerTreeRow = {
  id: string;
  name: string;
  type: string;
  depth: number;
  zIndex: number;
  visible: boolean;
  hasChildren: boolean;
  parentLayerId: string | null;
};

function nodeDisplayName(node: MotionLayer): string {
  if (typeof node.name === "string" && node.name.trim()) return node.name;
  return `${node.type}:${node.id}`;
}

function nodeVisible(node: MotionLayer): boolean {
  return !("appearance" in node) || node.appearance?.visible !== false;
}

function sortSiblings(a: LayerTreeNode, b: LayerTreeNode): number {
  if (b.zIndex !== a.zIndex) return b.zIndex - a.zIndex;
  return a.declarationIndex - b.declarationIndex;
}

/**
 * Dựng rừng từ danh sách layer phẳng (project.layers hoặc group.children).
 * Orphan (parent không xác định) và nút cắt vòng lặp trở thành root.
 */
export function buildLayerTree(
  layers: MotionLayer[] | null | undefined,
): LayerTreeNode[] {
  if (!layers) return [];
  if (layers.length === 0) return [];

  const idSet = new Set(layers.map((n) => n.id));
  const declarationIndex = new Map(layers.map((n, index) => [n.id, index]));
  const byParent = new Map<string | null, MotionLayer[]>();

  for (const node of layers) {
    let parentKey: string | null = node.parentLayerId;
    if (parentKey != null && !idSet.has(parentKey)) {
      parentKey = null;
    }
    const list = byParent.get(parentKey);
    if (list) list.push(node);
    else byParent.set(parentKey, [node]);
  }

  const visiting = new Set<string>();
  const built = new Set<string>();

  function parentKeyFor(node: MotionLayer): string | null {
    const p = node.parentLayerId;
    if (p != null && idSet.has(p)) return p;
    return null;
  }

  function buildNode(node: MotionLayer, depth: number): LayerTreeNode | null {
    if (visiting.has(node.id)) return null;
    if (built.has(node.id)) return null;
    visiting.add(node.id);
    const childrenRaw = byParent.get(node.id) ?? [];
    const children: LayerTreeNode[] = [];
    for (const child of childrenRaw) {
      const next = buildNode(child, depth + 1);
      if (next) children.push(next);
    }
    children.sort(sortSiblings);
    visiting.delete(node.id);
    built.add(node.id);
    return {
      id: node.id,
      name: nodeDisplayName(node),
      type: node.type,
      depth,
      zIndex: node.zIndex ?? 0,
      declarationIndex: declarationIndex.get(node.id) ?? 0,
      visible: nodeVisible(node),
      parentLayerId: parentKeyFor(node),
      children,
    };
  }

  const roots: LayerTreeNode[] = [];
  for (const node of byParent.get(null) ?? []) {
    const tree = buildNode(node, 0);
    if (tree) roots.push(tree);
  }

  for (const node of layers) {
    if (built.has(node.id)) continue;
    visiting.clear();
    const tree = buildNode(node, 0);
    if (tree) roots.push(tree);
  }

  roots.sort(sortSiblings);
  return roots;
}

/** Collect every node id that has children (default-expand set). */
export function collectExpandableIds(
  roots: readonly LayerTreeNode[],
): string[] {
  const ids: string[] = [];
  const walk = (layers: readonly LayerTreeNode[]) => {
    for (const n of layers) {
      if (n.children.length > 0) {
        ids.push(n.id);
        walk(n.children);
      }
    }
  };
  walk(roots);
  return ids;
}

/**
 * Depth-first flatten respecting expand set.
 * Nodes without children are always listed; parents only expand when id ∈ expandedIds.
 */
export function flattenVisibleTree(
  roots: readonly LayerTreeNode[],
  expandedIds: ReadonlySet<string>,
): LayerTreeRow[] {
  const rows: LayerTreeRow[] = [];
  const walk = (layers: readonly LayerTreeNode[]) => {
    for (const n of layers) {
      const hasChildren = n.children.length > 0;
      rows.push({
        id: n.id,
        name: n.name,
        type: n.type,
        depth: n.depth,
        zIndex: n.zIndex,
        visible: n.visible,
        hasChildren,
        parentLayerId: n.parentLayerId,
      });
      if (hasChildren && expandedIds.has(n.id)) {
        walk(n.children);
      }
    }
  };
  walk(roots);
  return rows;
}

/** Pre-order DFS ids (matches sidebar top→bottom when fully expanded). */
export function collectDfsLayerIds(roots: readonly LayerTreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (layers: readonly LayerTreeNode[]) => {
    for (const n of layers) {
      ids.push(n.id);
      walk(n.children);
    }
  };
  walk(roots);
  return ids;
}

function findNode(
  roots: readonly LayerTreeNode[],
  id: string,
): LayerTreeNode | null {
  for (const n of roots) {
    if (n.id === id) return n;
    const hit = findNode(n.children, id);
    if (hit) return hit;
  }
  return null;
}

function getSiblingList(
  roots: LayerTreeNode[],
  layerId: string,
): { siblings: LayerTreeNode[]; index: number } | null {
  const node = findNode(roots, layerId);
  if (!node) return null;
  const siblings =
    node.parentLayerId == null
      ? roots
      : (findNode(roots, node.parentLayerId)?.children ?? null);
  if (!siblings) return null;
  const index = siblings.findIndex((s) => s.id === layerId);
  if (index < 0) return null;
  return { siblings, index };
}

/**
 * Reorder a node among its siblings (same parent). Returns full DFS id list
 * for `reorder-scene-layers`, or null if no-op / invalid.
 */
export function reorderSiblingAndCollectDfs(
  roots: readonly LayerTreeNode[],
  movingId: string,
  /** Insert before this sibling id; null = append after last sibling. */
  insertBeforeSiblingId: string | null,
): string[] | null {
  const cloned = structuredClone(roots) as LayerTreeNode[];
  const pack = getSiblingList(cloned, movingId);
  if (!pack) return null;
  const { siblings, index: from } = pack;

  let to =
    insertBeforeSiblingId == null
      ? siblings.length
      : siblings.findIndex((s) => s.id === insertBeforeSiblingId);
  if (to < 0) return null;

  // Dropped on own gap (before self or immediately after self) → no-op
  if (from === to || from + 1 === to) return null;

  const [moved] = siblings.splice(from, 1);
  if (!moved) return null;
  if (from < to) to -= 1;
  siblings.splice(to, 0, moved);

  return collectDfsLayerIds(cloned);
}

/**
 * Resolve insert target among siblings from flattened row hover.
 */
export function resolveSidebarSiblingInsert(
  rows: readonly LayerTreeRow[],
  movingId: string,
  hoverId: string,
  edge: "before" | "after",
): { insertBeforeSiblingId: string | null } | null {
  const moving = rows.find((r) => r.id === movingId);
  const hover = rows.find((r) => r.id === hoverId);
  if (!moving || !hover) return null;
  if (moving.parentLayerId !== hover.parentLayerId) return null;
  if (movingId === hoverId) {
    return { insertBeforeSiblingId: movingId };
  }

  const siblings = rows.filter((r) => r.parentLayerId === moving.parentLayerId);
  const hoverIndex = siblings.findIndex((r) => r.id === hoverId);
  if (hoverIndex < 0) return null;

  if (edge === "before") {
    return { insertBeforeSiblingId: hoverId };
  }
  const next = siblings[hoverIndex + 1];
  return { insertBeforeSiblingId: next?.id ?? null };
}
