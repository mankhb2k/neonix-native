import {
  MOTION_V2_LIMITS,
  motionPropertyCapability,
  type MotionNode,
  type MotionProject,
} from "@motionvideo/motion-schema";
import type { TimelineDocument } from "../document/document";
import { mapNode } from "../timeline/internal/scene-utils";
import type {
  DocumentPropertyCommand,
  MetadataPatch,
  PropertyDomainEvent,
  TransformPatch,
} from "./property-commands";

export type PropertyCommandResult =
  | {
      status: "applied";
      document: TimelineDocument;
      events: PropertyDomainEvent[];
    }
  | {
      status: "rejected";
      reason: "no_project" | "empty_targets" | "missing_node" | "invalid_value";
      message: string;
    };

function clampNumber(
  value: number,
  capabilityKey: string,
  nodeType: string,
): number {
  const cap = motionPropertyCapability(nodeType, capabilityKey);
  let next = value;
  if (!Number.isFinite(next)) return 0;
  if (cap?.min !== undefined) next = Math.max(cap.min, next);
  if (cap?.minExclusive !== undefined) next = Math.max(cap.minExclusive + Number.EPSILON, next);
  if (cap?.max !== undefined) next = Math.min(cap.max, next);
  return next;
}

function applyTransformPatch(
  node: MotionNode,
  patch: TransformPatch,
): MotionNode {
  const t = node.transform;
  const type = node.type;
  return {
    ...node,
    transform: {
      ...t,
      x:
        patch.x !== undefined
          ? clampNumber(patch.x, "transform.x", type)
          : t.x,
      y:
        patch.y !== undefined
          ? clampNumber(patch.y, "transform.y", type)
          : t.y,
      rotation:
        patch.rotation !== undefined
          ? clampNumber(patch.rotation, "transform.rotation", type)
          : t.rotation,
      scaleX:
        patch.scaleX !== undefined
          ? clampNumber(patch.scaleX, "transform.scaleX", type)
          : t.scaleX,
      scaleY:
        patch.scaleY !== undefined
          ? clampNumber(patch.scaleY, "transform.scaleY", type)
          : t.scaleY,
    },
  };
}

function applyOpacity(node: MotionNode, opacity: number): MotionNode {
  return {
    ...node,
    transform: {
      ...node.transform,
      opacity: clampNumber(opacity, "transform.opacity", node.type),
    },
  };
}

function applyMetadata(node: MotionNode, patch: MetadataPatch): MotionNode {
  let next: MotionNode = node;
  if (patch.visible !== undefined) {
    next = {
      ...next,
      transform: { ...next.transform, visible: Boolean(patch.visible) },
    };
  }
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) {
      const rest = { ...next };
      delete (rest as { name?: string }).name;
      next = rest as MotionNode;
    } else {
      next = { ...next, name: name.slice(0, MOTION_V2_LIMITS.idLength) };
    }
  }
  return next;
}

function applyToTargets(
  project: MotionProject,
  targets: DocumentPropertyCommand["targets"],
  transform: (node: MotionNode) => MotionNode,
): { project: MotionProject; missing: boolean } {
  let next = project;
  for (const target of targets) {
    const scene = next.scenes.find((s) => s.id === target.sceneId);
    const node = scene?.nodes.find((n) => n.id === target.nodeId);
    if (!scene || !node) {
      return { project: next, missing: true };
    }
    next = mapNode(next, target.sceneId, target.nodeId, transform);
  }
  return { project: next, missing: false };
}

export function executePropertyCommand(
  document: TimelineDocument,
  command: DocumentPropertyCommand,
): PropertyCommandResult {
  if (!document.project) {
    return {
      status: "rejected",
      reason: "no_project",
      message: "No project loaded.",
    };
  }
  if (!command.targets.length) {
    return {
      status: "rejected",
      reason: "empty_targets",
      message: "No node targets for property command.",
    };
  }

  let result: { project: MotionProject; missing: boolean };
  let events: PropertyDomainEvent[];

  switch (command.type) {
    case "set-node-transform": {
      if (
        command.patch.x === undefined &&
        command.patch.y === undefined &&
        command.patch.rotation === undefined &&
        command.patch.scaleX === undefined &&
        command.patch.scaleY === undefined
      ) {
        return {
          status: "rejected",
          reason: "invalid_value",
          message: "Empty transform patch.",
        };
      }
      result = applyToTargets(document.project, command.targets, (node) =>
        applyTransformPatch(node, command.patch),
      );
      events = [
        { type: "node-transform-changed", targets: command.targets },
      ];
      break;
    }
    case "set-node-opacity": {
      if (!Number.isFinite(command.opacity)) {
        return {
          status: "rejected",
          reason: "invalid_value",
          message: "Opacity must be a finite number.",
        };
      }
      result = applyToTargets(document.project, command.targets, (node) =>
        applyOpacity(node, command.opacity),
      );
      events = [{ type: "node-opacity-changed", targets: command.targets }];
      break;
    }
    case "set-node-metadata": {
      if (
        command.patch.name === undefined &&
        command.patch.visible === undefined
      ) {
        return {
          status: "rejected",
          reason: "invalid_value",
          message: "Empty metadata patch.",
        };
      }
      result = applyToTargets(document.project, command.targets, (node) =>
        applyMetadata(node, command.patch),
      );
      events = [
        { type: "node-metadata-changed", targets: command.targets },
      ];
      break;
    }
    default: {
      const _exhaustive: never = command;
      return {
        status: "rejected",
        reason: "invalid_value",
        message: `Unknown command: ${JSON.stringify(_exhaustive)}`,
      };
    }
  }

  if (result.missing) {
    return {
      status: "rejected",
      reason: "missing_node",
      message: "One or more node targets were not found.",
    };
  }

  return {
    status: "applied",
    document: {
      ...document,
      project: result.project,
    },
    events,
  };
}
