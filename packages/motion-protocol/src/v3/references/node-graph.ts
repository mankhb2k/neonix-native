/**
 * V3 node-graph validation: duplicate ids, parent refs, mask sources.
 */
import type { NodeV3 } from "../nodes";
import { duplicates } from "./helpers";
import type { ReferenceIssue } from "./types";

export function validateNodeGraphV3(
  nodes: NodeV3[],
  prefix: string,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const ids = nodes.map((node) => node.id);
  for (const id of new Set(duplicates(ids))) {
    issues.push({ path: prefix, message: `Duplicate node id: ${id}` });
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    if (node.parentId !== null && !byId.has(node.parentId)) {
      issues.push({
        path: `${prefix}.${node.id}.parentId`,
        message: `Unknown parent node: ${node.parentId}`,
      });
    }
    if (node.mask) {
      const source = byId.get(node.mask.sourceNodeId);
      if (!source) {
        issues.push({
          path: `${prefix}.${node.id}.mask.sourceNodeId`,
          message: `Unknown mask source node: ${node.mask.sourceNodeId}`,
        });
      }
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
  return issues;
}
