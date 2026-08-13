/**
 * V3 node-graph validation: duplicate ids, parent refs, mask sources,
 * self-parent, cycles, depth, group-only children, and unique zIndex
 * per parent (sibling stack order must be deterministic).
 */
import type { NodeV3 } from "../nodes";
import { duplicates } from "./helpers";
import type { ReferenceIssue } from "./types";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";

export function validateNodeGraphV3(
  nodes: NodeV3[],
  prefix: string,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];

  // ── Duplicate ids ──────────────────────────────────────────────────
  const ids = nodes.map((node) => node.id);
  for (const id of new Set(duplicates(ids))) {
    issues.push({ path: prefix, message: `Duplicate node id: ${id}` });
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));

  for (const node of nodes) {
    // ── Self-parent ──────────────────────────────────────────────────
    if (node.parentId === node.id) {
      issues.push({
        path: `${prefix}.${node.id}.parentId`,
        message: `Node cannot be its own parent: ${node.id}`,
      });
    }

    // ── Unknown parent ───────────────────────────────────────────────
    if (node.parentId !== null && !byId.has(node.parentId)) {
      issues.push({
        path: `${prefix}.${node.id}.parentId`,
        message: `Unknown parent node: ${node.parentId}`,
      });
    }

    // ── Non-group parent ─────────────────────────────────────────────
    if (node.parentId !== null && node.parentId !== node.id) {
      const parent = byId.get(node.parentId);
      if (parent && parent.type !== "group") {
        issues.push({
          path: `${prefix}.${node.id}.parentId`,
          message: `Parent node ${node.parentId} has type "${parent.type}" — only "group" nodes may have children`,
        });
      }
    }

    // ── Mask source ──────────────────────────────────────────────────
    if (node.mask) {
      const source = byId.get(node.mask.sourceNodeId);
      if (!source) {
        issues.push({
          path: `${prefix}.${node.id}.mask.sourceNodeId`,
          message: `Unknown mask source node: ${node.mask.sourceNodeId}`,
        });
      }
    }

    // ── Bone rotation limits ─────────────────────────────────────────
    if (
      node.type === "bone" &&
      node.payload.rotationLimits &&
      node.payload.rotationLimits.min > node.payload.rotationLimits.max
    ) {
      issues.push({
        path: `${prefix}.${node.id}.payload.rotationLimits.max`,
        message: "Bone rotation limit max must be >= min",
      });
    }
  }

  // ── Unique zIndex among siblings (same parentId) ─────────────────
  issues.push(...checkUniqueZIndexPerParent(nodes, prefix));

  // ── Cycle detection ────────────────────────────────────────────────
  issues.push(...detectCycles(nodes, byId, prefix));

  // ── Hierarchy depth ────────────────────────────────────────────────
  issues.push(...checkHierarchyDepth(nodes, byId, prefix));

  return issues;
}

/**
 * Render order among siblings must be deterministic: within the same
 * `parentId` (including root `null`), `zIndex` values must be unique.
 * Nodes under different parents may share the same zIndex.
 */
function checkUniqueZIndexPerParent(
  nodes: NodeV3[],
  prefix: string,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const byParent = new Map<string, NodeV3[]>();

  for (const node of nodes) {
    const key = node.parentId ?? "$root";
    const list = byParent.get(key);
    if (list) list.push(node);
    else byParent.set(key, [node]);
  }

  for (const siblings of byParent.values()) {
    const seen = new Map<number, string>();
    for (const node of siblings) {
      // Optional zIndex defaults to 0 for stack-order uniqueness (matches
      // common authoring omission → explicit sibling order required).
      const z = node.zIndex ?? 0;
      const prev = seen.get(z);
      if (prev !== undefined) {
        issues.push({
          path: `${prefix}.${node.id}.zIndex`,
          message: `Duplicate zIndex ${z} among siblings of parent ${node.parentId ?? "null"} (also used by "${prev}")`,
        });
      } else {
        seen.set(z, node.id);
      }
    }
  }

  return issues;
}

// ── Cycle detection (DFS with coloring) ──────────────────────────────

function detectCycles(
  nodes: NodeV3[],
  byId: Map<string, NodeV3>,
  prefix: string,
): ReferenceIssue[] {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();

  for (const node of nodes) {
    color.set(node.id, WHITE);
  }

  function visit(id: string, path: string[]): ReferenceIssue | null {
    const c = color.get(id);
    if (c === GRAY) {
      const cyclePath = [...path, id].join(" → ");
      return {
        path: `${prefix}.${id}.parentId`,
        message: `Parent cycle detected: ${cyclePath}`,
      };
    }
    if (c === BLACK) return null;

    color.set(id, GRAY);
    const node = byId.get(id);
    if (node && node.parentId !== null && node.parentId !== id) {
      const result = visit(node.parentId, [...path, id]);
      if (result) return result;
    }
    color.set(id, BLACK);
    return null;
  }

  for (const node of nodes) {
    if (color.get(node.id) === WHITE) {
      const result = visit(node.id, []);
      if (result) return [result];
    }
  }

  return [];
}

// ── Hierarchy depth check ────────────────────────────────────────────

function checkHierarchyDepth(
  nodes: NodeV3[],
  byId: Map<string, NodeV3>,
  prefix: string,
): ReferenceIssue[] {
  const maxDepth = MOTION_PROTOCOL_LIMITS.hierarchyDepth;
  const depthCache = new Map<string, number>();

  function depth(id: string, visited: Set<string>): number {
    if (depthCache.has(id)) return depthCache.get(id)!;
    if (visited.has(id)) return 0; // should not happen after cycle check
    visited.add(id);

    const node = byId.get(id);
    if (!node || node.parentId === null || node.parentId === id) {
      depthCache.set(id, 1);
      return 1;
    }

    const d = 1 + depth(node.parentId, visited);
    depthCache.set(id, d);
    return d;
  }

  for (const node of nodes) {
    const d = depth(node.id, new Set());
    if (d > maxDepth) {
      return [
        {
          path: `${prefix}.${node.id}`,
          message: `Node hierarchy depth ${d} exceeds limit ${maxDepth}`,
        },
      ];
    }
  }

  return [];
}
