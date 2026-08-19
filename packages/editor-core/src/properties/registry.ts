import {
  motionPropertyCapability,
  getTextPayloadPlain,
} from "@motionvideo/motion-protocol";
import { readUniform } from "./mixed";
import type { DocumentPropertyCommand } from "./property-commands";
import { findNode } from "./resolve-targets";
import type {
  MixedValue,
  PropertyContext,
  PropertyDefinition,
  ValidationResult,
  Vector2,
} from "./types";

function hasTargets(context: PropertyContext): boolean {
  return context.targets.length > 0;
}

function allTargetsOfType(
  context: PropertyContext,
  types: readonly string[],
): boolean {
  if (!context.targets.length) return false;
  return context.targets.every((t) => {
    const node = findNode(context.project, t.rootLayerId, t.layerId);
    return node != null && types.includes(node.type);
  });
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
        context.targets[0].rootLayerId,
        context.targets[0].layerId,
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
    const node = findNode(context.project, t.rootLayerId, t.layerId);
    if (!node || !("transform" in node)) return 0;
    const tr = node.transform;
    switch (key) {
      case "x":
        return tr.translate.x;
      case "y":
        return tr.translate.y;
      case "rotation":
        return tr.rotate.z;
      case "scaleX":
        return tr.scale.x;
      case "scaleY":
        return tr.scale.y;
      case "opacity":
        return "opacity" in node ? (node.opacity ?? 100) : 100;
    }
  });
  return readUniform(values);
}

function transformCommand(
  key: "x" | "y" | "rotation" | "scaleX" | "scaleY",
  value: number,
  context: PropertyContext,
  lockAspect = false,
): DocumentPropertyCommand {
  return {
    type: "set-node-transform",
    targets: context.targets,
    patch: lockAspect ? { [key]: value, lockAspect: true } : { [key]: value },
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
  "transform.translate.x",
  "X",
  "Transform",
  "transform.translate.x",
  "x",
);
const transformY = numberProp(
  "transform.translate.y",
  "Y",
  "Transform",
  "transform.translate.y",
  "y",
);
const transformRotation = numberProp(
  "transform.rotate.z",
  "Rotation",
  "Transform",
  "transform.rotate.z",
  "rotation",
);
const transformScaleX = numberProp(
  "transform.scale.x",
  "Scale X",
  "Transform",
  "transform.scale.x",
  "scaleX",
);
const transformScaleY = numberProp(
  "transform.scale.y",
  "Scale Y",
  "Transform",
  "transform.scale.y",
  "scaleY",
);

/** Uniform scale (lock aspect) — writes both scaleX and scaleY. */
const transformScaleUniform: PropertyDefinition<number> = {
  id: "transform.scaleUniform",
  label: "Scale",
  group: "Transform",
  editor: "number",
  isVisible: hasTargets,
  read: (ctx) => {
    const values = ctx.targets.map((t) => {
      const node = findNode(ctx.project, t.rootLayerId, t.layerId);
      if (!node || !("transform" in node)) return 1;
      return Math.abs(node.transform.scale.x - node.transform.scale.y) < 1e-6
        ? node.transform.scale.x
        : node.transform.scale.x;
    });
    const sx = readUniform(
      ctx.targets.map((t) => {
        const node = findNode(ctx.project, t.rootLayerId, t.layerId);
        return node && "transform" in node ? node.transform.scale.x : 1;
      }),
    );
    const sy = readUniform(
      ctx.targets.map((t) => {
        const node = findNode(ctx.project, t.rootLayerId, t.layerId);
        return node && "transform" in node ? node.transform.scale.y : 1;
      }),
    );
    if (
      typeof sx === "object" ||
      typeof sy === "object" ||
      Math.abs((sx as number) - (sy as number)) > 1e-6
    ) {
      return { mixed: true };
    }
    void values;
    return sx as number;
  },
  createCommand: (value, ctx) => transformCommand("scaleX", value, ctx, true),
  validate: (value, ctx) => validateNumber(value, "transform.scale.x", ctx),
};

const transformOpacity: PropertyDefinition<number> = {
  id: "opacity",
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
  validate: (value, ctx) => validateNumber(value, "opacity", ctx),
};

const metadataName: PropertyDefinition<string> = {
  id: "metadata.name",
  label: "Name",
  group: "Metadata",
  editor: "string",
  isVisible: hasTargets,
  read: (ctx) => {
    const values = ctx.targets.map((t) => {
      const node = findNode(ctx.project, t.rootLayerId, t.layerId);
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
      const node = findNode(ctx.project, t.rootLayerId, t.layerId);
      if (!node || node.type === "audio") return true;
      const opacity = "opacity" in node ? node.opacity : 100;
      return typeof opacity === "number" ? opacity > 0 : true;
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

// Protocol V1: shape/path có PaintStyleSchema (fill + stroke); svg chỉ SvgStyleSchema
// { fill } (.strict()); text không có field style (màu nằm ở payload.color).
const FILL_TYPES = ["shape", "path", "svg"] as const;
const STROKE_TYPES = ["shape", "path"] as const;

function readStyleColor(
  ctx: PropertyContext,
  key: "fill" | "stroke",
): string | MixedValue {
  const values = ctx.targets.map((t) => {
    const node = findNode(ctx.project, t.rootLayerId, t.layerId);
    if (!node || !("style" in node) || !node.style) return "";
    const style = node.style as Record<string, unknown>;
    const raw = key in style ? style[key] : undefined;
    return typeof raw === "string" ? raw : "";
  });
  return readUniform(values);
}

const styleFill: PropertyDefinition<string> = {
  id: "style.fill",
  label: "Fill",
  group: "Fill / Stroke",
  editor: "color",
  isVisible: (ctx) => allTargetsOfType(ctx, FILL_TYPES),
  read: (ctx) => readStyleColor(ctx, "fill"),
  createCommand: (value, ctx) => ({
    type: "set-node-style",
    targets: ctx.targets,
    patch: { fill: value },
  }),
  validate: (value) => {
    if (typeof value !== "string" || !value.trim()) {
      return { ok: false, message: "Expected a color string." };
    }
    return { ok: true, value: value.trim() };
  },
};

const styleStroke: PropertyDefinition<string> = {
  id: "style.stroke",
  label: "Stroke",
  group: "Fill / Stroke",
  editor: "color",
  isVisible: (ctx) => allTargetsOfType(ctx, STROKE_TYPES),
  read: (ctx) => readStyleColor(ctx, "stroke"),
  createCommand: (value, ctx) => ({
    type: "set-node-style",
    targets: ctx.targets,
    patch: { stroke: value },
  }),
  validate: (value) => {
    if (typeof value !== "string" || !value.trim()) {
      return { ok: false, message: "Expected a color string." };
    }
    return { ok: true, value: value.trim() };
  },
};

const styleStrokeWidth: PropertyDefinition<number> = {
  id: "style.strokeWidth",
  label: "Stroke Width",
  group: "Fill / Stroke",
  editor: "number",
  isVisible: (ctx) => allTargetsOfType(ctx, STROKE_TYPES),
  read: (ctx) => {
    const values = ctx.targets.map((t) => {
      const node = findNode(ctx.project, t.rootLayerId, t.layerId);
      if (!node || !("style" in node) || !node.style) return 0;
      const sw = (node.style as Record<string, unknown>).strokeWidth;
      return typeof sw === "number" ? sw : 0;
    });
    return readUniform(values);
  },
  createCommand: (value, ctx) => ({
    type: "set-node-style",
    targets: ctx.targets,
    patch: { strokeWidth: value },
  }),
  validate: (value, ctx) => validateNumber(value, "style.strokeWidth", ctx),
};

const textContent: PropertyDefinition<string> = {
  id: "text.content",
  label: "Text",
  group: "Typography",
  editor: "string",
  isVisible: (ctx) => allTargetsOfType(ctx, ["text"]),
  read: (ctx) => {
    const values = ctx.targets.map((t) => {
      const node = findNode(ctx.project, t.rootLayerId, t.layerId);
      return node?.type === "text" ? getTextPayloadPlain(node.payload) : "";
    });
    return readUniform(values);
  },
  createCommand: (value, ctx) => ({
    type: "set-node-text",
    targets: ctx.targets,
    patch: { text: value },
  }),
  validate: (value) =>
    typeof value === "string"
      ? { ok: true, value }
      : { ok: false, message: "Expected a string." },
};

const textFontSize: PropertyDefinition<number> = {
  id: "text.fontSize",
  label: "Font Size",
  group: "Typography",
  editor: "number",
  isVisible: (ctx) => allTargetsOfType(ctx, ["text"]),
  read: (ctx) => {
    const values = ctx.targets.map((t) => {
      const node = findNode(ctx.project, t.rootLayerId, t.layerId);
      return node?.type === "text" ? node.payload.fontSize : 16;
    });
    return readUniform(values);
  },
  createCommand: (value, ctx) => ({
    type: "set-node-text",
    targets: ctx.targets,
    patch: { fontSize: value },
  }),
  validate: (value, ctx) => validateNumber(value, "payload.fontSize", ctx),
};

const textAlign: PropertyDefinition<string> = {
  id: "text.align",
  label: "Align",
  group: "Typography",
  editor: "enum",
  options: [
    { value: "left", label: "Left" },
    { value: "center", label: "Center" },
    { value: "right", label: "Right" },
  ],
  isVisible: (ctx) => allTargetsOfType(ctx, ["text"]),
  read: (ctx) => {
    const values = ctx.targets.map((t) => {
      const node = findNode(ctx.project, t.rootLayerId, t.layerId);
      return node?.type === "text"
        ? (node.payload.alignment ?? "left")
        : "left";
    });
    return readUniform(values);
  },
  createCommand: (value, ctx) => ({
    type: "set-node-text",
    targets: ctx.targets,
    patch: { align: value as "left" | "center" | "right" },
  }),
  validate: (value) => {
    if (value !== "left" && value !== "center" && value !== "right") {
      return { ok: false, message: "Invalid align." };
    }
    return { ok: true, value };
  },
};

const mediaFit: PropertyDefinition<string> = {
  id: "media.fit",
  label: "Fit",
  group: "Media",
  editor: "enum",
  options: [
    { value: "contain", label: "Contain" },
    { value: "cover", label: "Cover" },
    { value: "fill", label: "Fill" },
    { value: "none", label: "None" },
  ],
  isVisible: (ctx) => allTargetsOfType(ctx, ["image", "svg", "video"]),
  read: (ctx) => {
    const values = ctx.targets.map((t) => {
      const node = findNode(ctx.project, t.rootLayerId, t.layerId);
      if (
        node &&
        (node.type === "image" || node.type === "svg" || node.type === "video")
      ) {
        return node.payload.fit ?? "contain";
      }
      return "contain";
    });
    return readUniform(values);
  },
  createCommand: (value, ctx) => ({
    type: "set-node-media",
    targets: ctx.targets,
    patch: {
      fit: value as "contain" | "cover" | "fill" | "none",
    },
  }),
  validate: (value) => {
    if (!["contain", "cover", "fill", "none"].includes(value)) {
      return { ok: false, message: "Invalid fit." };
    }
    return { ok: true, value };
  },
};

const mediaCropOrigin: PropertyDefinition<Vector2> = {
  id: "media.cropOrigin",
  label: "Crop Origin",
  group: "Media",
  editor: "vector",
  // Protocol: crop chỉ tồn tại trên image (svg/video payload không có crop).
  isVisible: (ctx) => allTargetsOfType(ctx, ["image"]),
  read: (ctx) => {
    const values = ctx.targets.map((t) => {
      const node = findNode(ctx.project, t.rootLayerId, t.layerId);
      if (node?.type === "image") {
        return { x: node.payload.crop?.x ?? 0, y: node.payload.crop?.y ?? 0 };
      }
      return { x: 0, y: 0 };
    });
    const xs = readUniform(values.map((v) => v.x));
    const ys = readUniform(values.map((v) => v.y));
    if (typeof xs === "object" || typeof ys === "object") {
      return { mixed: true };
    }
    return { x: xs as number, y: ys as number };
  },
  createCommand: (value, ctx) => {
    return {
      type: "set-node-media",
      targets: ctx.targets,
      patch: {
        // Origin only — applyMedia preserves each target's width/height.
        crop: { x: value.x, y: value.y },
      },
    };
  },
  validate: (value) => {
    if (
      !value ||
      typeof value.x !== "number" ||
      typeof value.y !== "number" ||
      !Number.isFinite(value.x) ||
      !Number.isFinite(value.y)
    ) {
      return { ok: false, message: "Expected vector {x,y}." };
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
  transformScaleUniform,
  transformOpacity,
  metadataName,
  metadataVisible,
  styleFill,
  styleStroke,
  styleStrokeWidth,
  textContent,
  textFontSize,
  textAlign,
  mediaFit,
  mediaCropOrigin,
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
