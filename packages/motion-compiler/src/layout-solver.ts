import type { MotionNode } from "@motionvideo/motion-protocol";
import { getTextPayloadPlain } from "@motionvideo/motion-protocol";
import {
  estimateTextSize,
  type TextMeasurementProvider,
  defaultTextMeasurementProvider,
} from "./text-layout";

type LayoutConstraint = Extract<
  NonNullable<MotionNode["modifiers"]>[number],
  { type: "layout" }
>["constraint"];

type LayoutItemPolicy = {
  width?: "fixed" | "content" | "fill";
  height?: "fixed" | "content" | "fill";
  grow?: number;
  shrink?: number;
  alignSelf?: "auto" | "start" | "center" | "end" | "stretch";
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
};

type EdgeInsets = { top: number; right: number; bottom: number; left: number };

type MutableNode = MotionNode & {
  transform: MotionNode["transform"] & {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

function normalizePadding(
  padding: number | EdgeInsets | undefined,
): EdgeInsets {
  if (padding == null) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof padding === "number") {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return padding;
}

function readItemPolicy(node: MotionNode): LayoutItemPolicy {
  const mod = (node.modifiers ?? []).find((m) => m.type === "layout-item");
  return mod && mod.type === "layout-item" ? (mod.policy ?? {}) : {};
}

function measureIntrinsic(
  node: MutableNode,
  measure: TextMeasurementProvider,
): { width: number; height: number } {
  if (node.type === "text") {
    const size = estimateTextSize(
      {
        text: getTextPayloadPlain(node.payload),
        fontSize: node.payload.fontSize,
        letterSpacing: node.payload.letterSpacing,
        lineHeight: node.payload.lineHeight,
        wrap: node.payload.wrap,
        maxWidth: node.transform.width,
        maxLines: node.payload.maxLines,
      },
      measure,
    );
    return size;
  }
  return { width: node.transform.width, height: node.transform.height };
}

function applyItemSizing(
  child: MutableNode,
  policy: LayoutItemPolicy,
  measure: TextMeasurementProvider,
  fillWidth: number,
  fillHeight: number,
): void {
  const intrinsic = measureIntrinsic(child, measure);
  const widthMode = policy.width ?? "fixed";
  const heightMode = policy.height ?? "fixed";
  let width = child.transform.width;
  let height = child.transform.height;
  if (widthMode === "content") width = intrinsic.width;
  if (widthMode === "fill") width = fillWidth;
  if (heightMode === "content") height = intrinsic.height;
  if (heightMode === "fill") height = fillHeight;
  if (policy.minWidth != null) width = Math.max(policy.minWidth, width);
  if (policy.maxWidth != null) width = Math.min(policy.maxWidth, width);
  if (policy.minHeight != null) height = Math.max(policy.minHeight, height);
  if (policy.maxHeight != null) height = Math.min(policy.maxHeight, height);
  child.transform.width = width;
  child.transform.height = height;
}

/** Deterministic layout → literal transforms; layout modifiers are compile-time only. */
export function applyLayoutConstraints(
  nodes: MotionNode[],
  measure: TextMeasurementProvider = defaultTextMeasurementProvider,
): MotionNode[] {
  const byId = new Map(nodes.map((node) => [node.id, cloneNode(node)]));
  const ordered = [...byId.values()];

  for (const parent of ordered) {
    const layoutMods = (parent.modifiers ?? []).filter(
      (modifier) => modifier.type === "layout",
    );
    if (layoutMods.length === 0) continue;
    const children = ordered.filter((node) => node.parentId === parent.id);
    for (const modifier of layoutMods) {
      solveConstraint(parent, children, modifier.constraint, measure);
    }
  }

  return ordered.map((node) => {
    const modifiers = (node.modifiers ?? []).filter(
      (modifier) =>
        modifier.type !== "layout" && modifier.type !== "layout-item",
    );
    if (modifiers.length === (node.modifiers?.length ?? 0)) return node;
    const next = { ...node };
    if (modifiers.length === 0) delete next.modifiers;
    else next.modifiers = modifiers;
    return next;
  });
}

function cloneNode(node: MotionNode): MutableNode {
  return JSON.parse(JSON.stringify(node)) as MutableNode;
}

function solveConstraint(
  parent: MutableNode,
  children: MutableNode[],
  constraint: LayoutConstraint,
  measure: TextMeasurementProvider,
): void {
  if (children.length === 0) return;
  switch (constraint.kind) {
    case "stack": {
      const gap = constraint.gap ?? 0;
      const pad = normalizePadding(
        constraint.padding as number | EdgeInsets | undefined,
      );
      const justify =
        ("justify" in constraint ? constraint.justify : undefined) ?? "start";
      const align = constraint.align ?? "start";
      const innerW = Math.max(0, parent.transform.width - pad.left - pad.right);
      const innerH = Math.max(
        0,
        parent.transform.height - pad.top - pad.bottom,
      );

      for (const child of children) {
        applyItemSizing(child, readItemPolicy(child), measure, innerW, innerH);
        if (align === "stretch") {
          if (constraint.direction === "vertical")
            child.transform.width = innerW;
          else child.transform.height = innerH;
        }
        const self = readItemPolicy(child).alignSelf;
        if (self === "stretch") {
          if (constraint.direction === "vertical")
            child.transform.width = innerW;
          else child.transform.height = innerH;
        }
      }

      const sizes = children.map((c) =>
        constraint.direction === "vertical"
          ? c.transform.height
          : c.transform.width,
      );
      const occupied =
        sizes.reduce((sum, s) => sum + s, 0) +
        gap * Math.max(0, children.length - 1);
      const free = Math.max(
        0,
        (constraint.direction === "vertical" ? innerH : innerW) - occupied,
      );
      let cursor =
        constraint.direction === "vertical"
          ? pad.top +
            (justify === "center" ? free / 2 : justify === "end" ? free : 0)
          : pad.left +
            (justify === "center" ? free / 2 : justify === "end" ? free : 0);
      const between =
        justify === "space-between" && children.length > 1
          ? free / (children.length - 1)
          : gap;

      for (let i = 0; i < children.length; i += 1) {
        const child = children[i]!;
        const policy = readItemPolicy(child);
        const crossAlign =
          policy.alignSelf && policy.alignSelf !== "auto"
            ? policy.alignSelf
            : align;
        if (constraint.direction === "vertical") {
          child.transform.y = cursor;
          child.transform.x = alignCross(
            crossAlign,
            parent.transform.width,
            child.transform.width,
            pad.left,
            pad.right,
          );
          cursor += child.transform.height + between;
        } else {
          child.transform.x = cursor;
          child.transform.y = alignCross(
            crossAlign,
            parent.transform.height,
            child.transform.height,
            pad.top,
            pad.bottom,
          );
          cursor += child.transform.width + between;
        }
      }
      return;
    }
    case "grid": {
      const gapX = constraint.gapX ?? 0;
      const gapY = constraint.gapY ?? 0;
      children.forEach((child, index) => {
        applyItemSizing(
          child,
          readItemPolicy(child),
          measure,
          child.transform.width,
          child.transform.height,
        );
        const col = index % constraint.columns;
        const row = Math.floor(index / constraint.columns);
        child.transform.x = col * (child.transform.width + gapX);
        child.transform.y = row * (child.transform.height + gapY);
      });
      return;
    }
    case "align": {
      for (const child of children) {
        if (constraint.axis === "x" || constraint.axis === "both") {
          child.transform.x = alignAxis(
            constraint.align,
            parent.transform.width,
            child.transform.width,
            0,
          );
        }
        if (constraint.axis === "y" || constraint.axis === "both") {
          child.transform.y = alignAxis(
            constraint.align,
            parent.transform.height,
            child.transform.height,
            0,
          );
        }
      }
      return;
    }
  }
}

function alignCross(
  align: string,
  parentSize: number,
  childSize: number,
  padStart: number,
  padEnd: number,
): number {
  if (align === "center") return (parentSize - childSize) / 2;
  if (align === "end")
    return Math.max(padStart, parentSize - childSize - padEnd);
  return padStart;
}

function alignAxis(
  align: "start" | "center" | "end",
  parentSize: number,
  childSize: number,
  padding: number,
): number {
  if (align === "center") return (parentSize - childSize) / 2;
  if (align === "end")
    return Math.max(padding, parentSize - childSize - padding);
  return padding;
}
