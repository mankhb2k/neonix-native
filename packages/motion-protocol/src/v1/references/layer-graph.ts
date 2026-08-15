/**
 * Validate đồ thị layer: id trùng, parent, mask, cycle, depth,
 * chỉ group có children, parentLayerId khớp, zIndex unique theo cha.
 */
import type { LayerV1 } from "../layers";
import { flattenLayerTree } from "../layers";
import { duplicates } from "./helpers";
import type { ReferenceIssue } from "./types";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import {
  FRAME_FORBIDDEN_LAYER_TYPES,
} from "../frame";

export function validateLayerGraphV1(
  roots: LayerV1[],
  prefix: string,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  issues.push(...validateNestedTree(roots, null, prefix));

  const layers = flattenLayerTree(roots);

  const ids = layers.map((node) => node.id);
  for (const id of new Set(duplicates(ids))) {
    issues.push({ path: prefix, message: `Duplicate layer id: ${id}` });
  }

  const byId = new Map(layers.map((node) => [node.id, node]));

  for (const node of layers) {
    if (node.parentLayerId === node.id) {
      issues.push({
        path: `${prefix}.${node.id}.parentLayerId`,
        message: `Layer cannot be its own parent: ${node.id}`,
      });
    }

    if (node.parentLayerId !== null && !byId.has(node.parentLayerId)) {
      issues.push({
        path: `${prefix}.${node.id}.parentLayerId`,
        message: `Unknown parent layer: ${node.parentLayerId}`,
      });
    }

    if (node.parentLayerId !== null && node.parentLayerId !== node.id) {
      const parent = byId.get(node.parentLayerId);
      if (parent && parent.type !== "group") {
        issues.push({
          path: `${prefix}.${node.id}.parentLayerId`,
          message: `Parent layer ${node.parentLayerId} has type "${parent.type}" — only "group" layers may have children`,
        });
      }
    }

    if (node.type === "group" && node.children.length === 0) {
      issues.push({
        path: `${prefix}.${node.id}.children`,
        message: `Group layer ${node.id} must have at least one child`,
      });
    }

    const forbidsFrame = (
      FRAME_FORBIDDEN_LAYER_TYPES as readonly string[]
    ).includes(node.type);
    const hasFrame = "frame" in node && Boolean(node.frame);

    if (!forbidsFrame && !hasFrame) {
      issues.push({
        path: `${prefix}.${node.id}.frame`,
        message: `Layer ${node.id} of type "${node.type}" requires frame.width and frame.height`,
      });
    }
    if (forbidsFrame && hasFrame) {
      issues.push({
        path: `${prefix}.${node.id}.frame`,
        message: `Layer ${node.id} of type "${node.type}" must not have frame`,
      });
    }

    if (node.type !== "group" && "layout" in node && node.layout) {
      issues.push({
        path: `${prefix}.${node.id}.layout`,
        message: `Only group layers may have layout; "${node.type}" cannot`,
      });
    }

    if ("layoutItem" in node && node.layoutItem) {
      if (node.parentLayerId === null) {
        issues.push({
          path: `${prefix}.${node.id}.layoutItem`,
          message: `Root layer ${node.id} cannot have layoutItem`,
        });
      } else {
        const parent = byId.get(node.parentLayerId);
        if (!parent || parent.type !== "group") {
          issues.push({
            path: `${prefix}.${node.id}.layoutItem`,
            message: `layoutItem is only valid on a child visual layer inside a group`,
          });
        } else if (!("layout" in parent) || !parent.layout) {
          issues.push({
            path: `${prefix}.${node.id}.layoutItem`,
            message: `layoutItem on ${node.id} requires parent group ${parent.id} to have layout`,
          });
        }
      }
    }

    if (
      node.type !== "audio" &&
      "compositing" in node &&
      node.compositing?.mask
    ) {
      issues.push(...validateMask(node, byId, prefix));
    }

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

  issues.push(...checkUniqueZIndexPerParent(layers, prefix));
  issues.push(...detectCycles(layers, byId, prefix));
  issues.push(...checkHierarchyDepth(layers, byId, prefix));

  return issues;
}

const CLIP_MASK_SOURCE_TYPES = new Set([
  "path",
  "shape",
  "solid",
  "group",
  "component",
]);

function validateMask(
  node: LayerV1,
  byId: Map<string, LayerV1>,
  prefix: string,
): ReferenceIssue[] {
  if (
    node.type === "audio" ||
    !("compositing" in node) ||
    !node.compositing?.mask
  )
    return [];
  const mask = node.compositing.mask;
  const issues: ReferenceIssue[] = [];
  const sourceId = mask.sourceLayerId;
  if (sourceId === node.id) {
    issues.push({
      path: `${prefix}.${node.id}.compositing.mask.sourceLayerId`,
      message: `Layer cannot mask itself: ${node.id}`,
    });
    return issues;
  }
  const source = byId.get(sourceId);
  if (!source) {
    issues.push({
      path: `${prefix}.${node.id}.compositing.mask.sourceLayerId`,
      message: `Unknown mask source layer: ${sourceId}`,
    });
    return issues;
  }
  if (!CLIP_MASK_SOURCE_TYPES.has(source.type)) {
    issues.push({
      path: `${prefix}.${node.id}.compositing.mask.sourceLayerId`,
      message: `Mask source "${sourceId}" has type "${source.type}" — clip sources must be path, shape, solid, group, or component`,
    });
  }
  return issues;
}

function validateNestedTree(
  nodes: LayerV1[],
  parentId: string | null,
  prefix: string,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  for (const node of nodes) {
    if (node.parentLayerId !== parentId) {
      issues.push({
        path: `${prefix}.${node.id}.parentLayerId`,
        message:
          parentId === null
            ? `Root layer ${node.id} must have parentLayerId: null`
            : `Layer ${node.id} parentLayerId must be "${parentId}"`,
      });
    }
    if (node.type === "group") {
      issues.push(...validateNestedTree(node.children, node.id, prefix));
    }
  }
  return issues;
}

/**
 * Render order among siblings must be deterministic: within the same
 * `parentLayerId` (including root `null`), `zIndex` values must be unique.
 * Nodes under different parents may share the same zIndex.
 */
function checkUniqueZIndexPerParent(
  layers: LayerV1[],
  prefix: string,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const byParent = new Map<string, LayerV1[]>();

  for (const node of layers) {
    const key = node.parentLayerId ?? "$root";
    const list = byParent.get(key);
    if (list) list.push(node);
    else byParent.set(key, [node]);
  }

  for (const siblings of byParent.values()) {
    const seen = new Map<number, string>();
    for (const node of siblings) {
      const z = node.zIndex;
      const prev = seen.get(z);
      if (prev !== undefined) {
        issues.push({
          path: `${prefix}.${node.id}.zIndex`,
          message: `Duplicate zIndex ${z} among siblings of parent ${node.parentLayerId ?? "null"} (also used by "${prev}")`,
        });
      } else {
        seen.set(z, node.id);
      }
    }
  }

  return issues;
}

function detectCycles(
  layers: LayerV1[],
  byId: Map<string, LayerV1>,
  prefix: string,
): ReferenceIssue[] {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();

  for (const node of layers) {
    color.set(node.id, WHITE);
  }

  function visit(id: string, path: string[]): ReferenceIssue | null {
    const c = color.get(id);
    if (c === GRAY) {
      const cyclePath = [...path, id].join(" → ");
      return {
        path: `${prefix}.${id}.parentLayerId`,
        message: `Parent cycle detected: ${cyclePath}`,
      };
    }
    if (c === BLACK) return null;

    color.set(id, GRAY);
    const node = byId.get(id);
    if (node && node.parentLayerId !== null && node.parentLayerId !== id) {
      const result = visit(node.parentLayerId, [...path, id]);
      if (result) return result;
    }
    color.set(id, BLACK);
    return null;
  }

  for (const node of layers) {
    if (color.get(node.id) === WHITE) {
      const result = visit(node.id, []);
      if (result) return [result];
    }
  }

  return [];
}

function checkHierarchyDepth(
  layers: LayerV1[],
  byId: Map<string, LayerV1>,
  prefix: string,
): ReferenceIssue[] {
  const maxDepth = MOTION_PROTOCOL_LIMITS.hierarchyDepth;
  const depthCache = new Map<string, number>();

  function depth(id: string, visited: Set<string>): number {
    if (depthCache.has(id)) return depthCache.get(id)!;
    if (visited.has(id)) return 0;
    visited.add(id);

    const node = byId.get(id);
    if (!node || node.parentLayerId === null || node.parentLayerId === id) {
      depthCache.set(id, 1);
      return 1;
    }

    const d = 1 + depth(node.parentLayerId, visited);
    depthCache.set(id, d);
    return d;
  }

  for (const node of layers) {
    const d = depth(node.id, new Set());
    if (d > maxDepth) {
      return [
        {
          path: `${prefix}.${node.id}`,
          message: `Layer hierarchy depth ${d} exceeds limit ${maxDepth}`,
        },
      ];
    }
  }

  return [];
}
