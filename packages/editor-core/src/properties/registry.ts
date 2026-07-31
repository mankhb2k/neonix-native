import { motionPropertyCapability } from "@motionvideo/motion-schema";
import { readUniform } from "./mixed";
import type { DocumentPropertyCommand } from "./property-commands";
import { findNode } from "./resolve-targets";
import type {
  MixedValue,
  PropertyContext,
  PropertyDefinition,
  ValidationResult,
} from "./types";

function hasTargets(context: PropertyContext): boolean {
  return context.targets.length > 0;
}

function validateNumber(
  value: number,
  capabilityKey: string,
  context: PropertyContext,
): ValidationResult {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, message: "Expected a finite number." };
  }
  const node = context.targets[0]
    ? findNode(
        context.project,
        context.targets[0].sceneId,
        context.targets[0].nodeId,
      )
    : null;
  const cap = motionPropertyCapability(node?.type ?? "text", capabilityKey);
  if (cap?.min !== undefined && value < cap.min) {
    return { ok: false, message: `Min ${cap.min}` };
  }
  if (cap?.max !== undefined && value > cap.max) {
    return { ok: false, message: `Max ${cap.max}` };
  }
  return { ok: true, value };
}

function readTransformNumber(
  context: PropertyContext,
  key: "x" | "y" | "rotation" | "scaleX" | "scaleY" | "opacity",
): number | MixedValue {
  const values = context.targets.map((t) => {
    const node = findNode(context.project, t.sceneId, t.nodeId);
    return node?.transform[key] ?? 0;
  });
  return readUniform(values);
}

function transformCommand(
  key: "x" | "y" | "rotation" | "scaleX" | "scaleY",
  value: number,
  context: PropertyContext,
): DocumentPropertyCommand {
  return {
    type: "set-node-transform",
    targets: context.targets,
    patch: { [key]: value },
  };
}

function numberProp(
  id: string,
  label: string,
  group: string,
  capabilityKey: string,
  key: "x" | "y" | "rotation" | "scaleX" | "scaleY",
): PropertyDefinition<number> {
  return {
    id,
    label,
    group,
    editor: "number",
    isVisible: hasTargets,
    read: (ctx) => readTransformNumber(ctx, key),
    createCommand: (value, ctx) => transformCommand(key, value, ctx),
    validate: (value, ctx) => validateNumber(value, capabilityKey, ctx),
  };
}

const transformX = numberProp(
  "transform.x",
  "X",
  "Transform",
  "transform.x",
  "x",
);
const transformY = numberProp(
  "transform.y",
  "Y",
  "Transform",
  "transform.y",
  "y",
);
const transformRotation = numberProp(
  "transform.rotation",
  "Rotation",
  "Transform",
  "transform.rotation",
  "rotation",
);
const transformScaleX = numberProp(
  "transform.scaleX",
  "Scale X",
  "Transform",
  "transform.scaleX",
  "scaleX",
);
const transformScaleY = numberProp(
  "transform.scaleY",
  "Scale Y",
  "Transform",
  "transform.scaleY",
  "scaleY",
);

const transformOpacity: PropertyDefinition<number> = {
  id: "transform.opacity",
  label: "Opacity",
  group: "Transform",
  editor: "number",
  isVisible: hasTargets,
  read: (ctx) => readTransformNumber(ctx, "opacity"),
  createCommand: (value, ctx) => ({
    type: "set-node-opacity",
    targets: ctx.targets,
    opacity: value,
  }),
  validate: (value, ctx) => validateNumber(value, "transform.opacity", ctx),
};

const metadataName: PropertyDefinition<string> = {
  id: "metadata.name",
  label: "Name",
  group: "Metadata",
  editor: "string",
  isVisible: hasTargets,
  read: (ctx) => {
    const values = ctx.targets.map((t) => {
      const node = findNode(ctx.project, t.sceneId, t.nodeId);
      return node?.name ?? node?.id ?? "";
    });
    return readUniform(values);
  },
  createCommand: (value, ctx) => ({
    type: "set-node-metadata",
    targets: ctx.targets,
    patch: { name: value },
  }),
  validate: (value) => {
    if (typeof value !== "string") {
      return { ok: false, message: "Expected a string." };
    }
    if (!value.trim()) {
      return { ok: false, message: "Name cannot be empty." };
    }
    return { ok: true, value: value.trim() };
  },
};

const metadataVisible: PropertyDefinition<boolean> = {
  id: "metadata.visible",
  label: "Visible",
  group: "Metadata",
  editor: "boolean",
  isVisible: hasTargets,
  read: (ctx) => {
    const values = ctx.targets.map((t) => {
      const node = findNode(ctx.project, t.sceneId, t.nodeId);
      return node?.transform.visible ?? true;
    });
    return readUniform(values);
  },
  createCommand: (value, ctx) => ({
    type: "set-node-metadata",
    targets: ctx.targets,
    patch: { visible: value },
  }),
  validate: (value) => {
    if (typeof value !== "boolean") {
      return { ok: false, message: "Expected a boolean." };
    }
    return { ok: true, value };
  },
};

/** Compile-time property registry — add entries here; Inspector maps by editor kind. */
export const PROPERTY_REGISTRY: readonly PropertyDefinition[] = [
  transformX,
  transformY,
  transformRotation,
  transformScaleX,
  transformScaleY,
  transformOpacity,
  metadataName,
  metadataVisible,
];

export function propertiesByGroup(
  context: PropertyContext,
): Map<string, PropertyDefinition[]> {
  const map = new Map<string, PropertyDefinition[]>();
  for (const prop of PROPERTY_REGISTRY) {
    if (!prop.isVisible(context)) continue;
    const list = map.get(prop.group) ?? [];
    list.push(prop);
    map.set(prop.group, list);
  }
  return map;
}

export function getPropertyDefinition(
  id: string,
): PropertyDefinition | undefined {
  return PROPERTY_REGISTRY.find((p) => p.id === id);
}
