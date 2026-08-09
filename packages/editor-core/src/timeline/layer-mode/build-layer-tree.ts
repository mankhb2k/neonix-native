/**
 * Scene node hierarchy for Figma-style Layers panel.
 * Document remains flat `scene.nodes` + parentId; this is view-model only.
 *
 * Moved from apps/desktop/gui/editor/timeline/layer-mode/build-layer-tree.ts
 */

import type { MotionNode, MotionScene } from "@motionvideo/motion-schema";

export type LayerTreeNode = {
  id: string;
  name: string;
  type: string;
  depth: number;
  zIndex: number;
  visible: boolean;
  parentId: string | null;
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
  parentId: string | null;
};

function nodeDisplayName(node: MotionNode): string {
  if (typeof node.name === "string" && node.name.trim()) return node.name;
  return `${node.type}:${node.id}`;
}

function nodeVisible(node: MotionNode): boolean {
  return node.transform?.visible !== false;
}

function sortSiblings(a: LayerTreeNode, b: LayerTreeNode): number {
  if (b.zIndex !== a.zIndex) return b.zIndex - a.zIndex;
  return a.id.localeCompare(b.id);
}

/**
 * Build a forest from scene.nodes.
 * Orphans (unknown parent) and cycle breakers become roots.
 */
export function buildLayerTree(
  scene: MotionScene | null | undefined,
): LayerTreeNode[] {
  if (!scene) return [];
  const nodes = scene.nodes ?? [];
  if (nodes.length === 0) return [];

  const idSet = new Set(nodes.map((n) => n.id));
  const byParent = new Map<string | null, MotionNode[]>();

  for (const node of nodes) {
    let parentKey: string | null = node.parentId;
    if (parentKey != null && !idSet.has(parentKey)) {
      parentKey = null;
    }
    const list = byParent.get(parentKey);
    if (list) list.push(node);
    else byParent.set(parentKey, [node]);
  }

  const visiting = new Set<string>();
  const built = new Set<string>();

  function parentKeyFor(node: MotionNode): string | null {
    const p = node.parentId;
    if (p != null && idSet.has(p)) return p;
    return null;
  }

  function buildNode(node: MotionNode, depth: number): LayerTreeNode | null {
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
      visible: nodeVisible(node),
      parentId: parentKeyFor(node),
      children,
    };
  }

  const roots: LayerTreeNode[] = [];
  for (const node of byParent.get(null) ?? []) {
    const tree = buildNode(node, 0);
    if (tree) roots.push(tree);
  }

  for (const node of nodes) {
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
  const walk = (nodes: readonly LayerTreeNode[]) => {
    for (const n of nodes) {
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
  const walk = (nodes: readonly LayerTreeNode[]) => {
    for (const n of nodes) {
      const hasChildren = n.children.length > 0;
      rows.push({
        id: n.id,
        name: n.name,
        type: n.type,
        depth: n.depth,
        zIndex: n.zIndex,
        visible: n.visible,
        hasChildren,
        parentId: n.parentId,
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
export function collectDfsNodeIds(roots: readonly LayerTreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (nodes: readonly LayerTreeNode[]) => {
    for (const n of nodes) {
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
  nodeId: string,
): { siblings: LayerTreeNode[]; index: number } | null {
  const node = findNode(roots, nodeId);
  if (!node) return null;
  const siblings =
    node.parentId == null
      ? roots
      : (findNode(roots, node.parentId)?.children ?? null);
  if (!siblings) return null;
  const index = siblings.findIndex((s) => s.id === nodeId);
  if (index < 0) return null;
  return { siblings, index };
}

/**
 * Reorder a node among its siblings (same parent). Returns full DFS id list
 * for `reorder-scene-nodes`, or null if no-op / invalid.
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

  return collectDfsNodeIds(cloned);
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
  if (moving.parentId !== hover.parentId) return null;
  if (movingId === hoverId) {
    return { insertBeforeSiblingId: movingId };
  }

  const siblings = rows.filter((r) => r.parentId === moving.parentId);
  const hoverIndex = siblings.findIndex((r) => r.id === hoverId);
  if (hoverIndex < 0) return null;

  if (edge === "before") {
    return { insertBeforeSiblingId: hoverId };
  }
  const next = siblings[hoverIndex + 1];
  return { insertBeforeSiblingId: next?.id ?? null };
}
