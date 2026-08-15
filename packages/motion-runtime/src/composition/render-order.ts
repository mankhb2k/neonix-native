/**
 * Hierarchy-aware render order (Phase 4 — Group Layer Semantics).
 *
 * V1 rule: zIndex is sibling-local. Children sort among siblings with
 * the same parentLayerId and cannot escape their parent's z-order.
 *
 * This module provides `hierarchyRenderOrder` which produces a
 * depth-first, zIndex-sorted flattening of the node tree.
 *
 * Example:
 *   Scene
 *     group.character     zIndex 1
 *       head              zIndex 99   ← stays inside group.character
 *     title               zIndex 2    ← renders ABOVE group.character
 *
 * Flat zIndex sort would put head (99) above title (2) — wrong.
 * Hierarchy sort produces: group.character → head → title  — correct.
 */

/** A node-like item that carries zIndex and parentLayerId for render ordering. */
export interface OrderableNode {
  readonly layer: {
    readonly id: string;
    readonly parentLayerId?: string | null;
    readonly zIndex?: number | null;
    readonly type?: string;
  };
}

/**
 * Sort a list of orderable layers by hierarchy-aware zIndex (ascending).
 *
 * Root siblings are sorted by zIndex first. Within each parent, children
 * are inserted immediately after their parent and before the next sibling,
 * preserving parent→children→next-sibling order.
 *
 * Tie-breaking: if zIndex is equal, order by declaration order (index in input).
 *
 * @returns A new array sorted for bottom-to-top rendering.
 */
export function hierarchyRenderOrder<T extends OrderableNode>(items: T[]): T[] {
  // Preserve original index for stable tie-breaking
  const withIndex = items.map((item, index) => ({ item, index }));

  // Group by parentLayerId (null → scene root)
  const byParent = new Map<string | null, typeof withIndex>();
  for (const entry of withIndex) {
    const pid = entry.item.layer.parentLayerId ?? null;
    const group = byParent.get(pid);
    if (group) {
      group.push(entry);
    } else {
      byParent.set(pid, [entry]);
    }
  }

  // Sort each sibling group by (zIndex, then original index)
  for (const [, group] of byParent) {
    group.sort((a, b) => {
      const zA = a.item.layer.zIndex ?? 0;
      const zB = b.item.layer.zIndex ?? 0;
      if (zA !== zB) return zA - zB;
      return a.index - b.index;
    });
  }

  // Recursive flatten: for each root sibling, emit it then its children
  function flatten(pid: string | null): typeof withIndex {
    const result: typeof withIndex = [];
    for (const entry of byParent.get(pid) ?? []) {
      result.push(entry);
      result.push(...flatten(entry.item.layer.id));
    }
    return result;
  }

  return flatten(null).map((e) => e.item);
}

/**
 * Same as hierarchyRenderOrder but in reverse (top-first), suitable for hit-testing.
 */
export function hierarchyRenderOrderReverse<T extends OrderableNode>(
  items: T[],
): T[] {
  return hierarchyRenderOrder(items).reverse();
}
