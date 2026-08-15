import type { MotionLayer } from "@motionvideo/motion-protocol";
import { getTextPayloadPlain } from "@motionvideo/motion-protocol";
import {
  estimateTextSize,
  type TextMeasurementProvider,
  defaultTextMeasurementProvider,
} from "./text-layout";

type VisualLayer = Exclude<MotionLayer, { type: "audio" }>;

function isVisualLayer(layer: MotionLayer): layer is VisualLayer {
  return layer.type !== "audio";
}

type LayoutConstraint = Extract<
  NonNullable<VisualLayer["modifiers"]>[number],
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

type MutableNode = VisualLayer;

function frameWidth(node: VisualLayer): number {
  return node.frame?.width ?? 0;
}

function frameHeight(node: VisualLayer): number {
  return node.frame?.height ?? 0;
}

function setFrameSize(node: MutableNode, width: number, height: number): void {
  node.frame = { width, height };
}

function translateX(node: VisualLayer): number {
  return node.transform.translate.x;
}

function translateY(node: VisualLayer): number {
  return node.transform.translate.y;
}

function setTranslate(node: MutableNode, x: number, y: number): void {
  node.transform.translate = { x, y };
}

function normalizePadding(
  padding: number | EdgeInsets | undefined,
): EdgeInsets {
  if (padding == null) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof padding === "number") {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return padding;
}

function readItemPolicy(node: VisualLayer): LayoutItemPolicy {
  const mod = (node.modifiers ?? []).find((m) => m.type === "layout-item");
  return mod && mod.type === "layout-item" ? (mod.policy ?? {}) : {};
}

function measureIntrinsic(
  node: MutableNode,
  measure: TextMeasurementProvider,
): { width: number; height: number } {
  if (node.type === "text") {
    return estimateTextSize(
      {
        text: getTextPayloadPlain(node.payload),
        fontSize: node.payload.fontSize,
        letterSpacing: node.payload.letterSpacing,
        lineHeight: node.payload.lineHeight,
        wrap: node.payload.wrap,
        maxWidth: frameWidth(node),
        maxLines: node.payload.maxLines,
      },
      measure,
    );
  }
  return { width: frameWidth(node), height: frameHeight(node) };
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
  let width = frameWidth(child);
  let height = frameHeight(child);
  if (widthMode === "content") width = intrinsic.width;
  if (widthMode === "fill") width = fillWidth;
  if (heightMode === "content") height = intrinsic.height;
  if (heightMode === "fill") height = fillHeight;
  if (policy.minWidth != null) width = Math.max(policy.minWidth, width);
  if (policy.maxWidth != null) width = Math.min(policy.maxWidth, width);
  if (policy.minHeight != null) height = Math.max(policy.minHeight, height);
  if (policy.maxHeight != null) height = Math.min(policy.maxHeight, height);
  setFrameSize(child, width, height);
}

/** Deterministic layout → literal frame + translate; layout modifiers compile-time only. */
export function applyLayoutConstraints(
  layers: MotionLayer[],
  measure: TextMeasurementProvider = defaultTextMeasurementProvider,
): MotionLayer[] {
  const byId = new Map(
    layers.filter(isVisualLayer).map((node) => [node.id, cloneNode(node)]),
  );
  const ordered = [...byId.values()];

  for (const parent of ordered) {
    const layoutMods = (parent.modifiers ?? []).filter(
      (modifier) => modifier.type === "layout",
    );
    if (layoutMods.length === 0) continue;
    const children = ordered.filter((node) => node.parentLayerId === parent.id);
    for (const modifier of layoutMods) {
      solveConstraint(parent, children, modifier.constraint, measure);
    }
  }

  const visual = ordered.map((node) => {
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
  return layers.map((layer) => {
    if (layer.type === "audio") return layer;
    return visual.find((node) => node.id === layer.id) ?? layer;
  });
}

function cloneNode(node: VisualLayer): MutableNode {
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
      const innerW = Math.max(0, frameWidth(parent) - pad.left - pad.right);
      const innerH = Math.max(0, frameHeight(parent) - pad.top - pad.bottom);

      for (const child of children) {
        applyItemSizing(child, readItemPolicy(child), measure, innerW, innerH);
        if (align === "stretch") {
          if (constraint.direction === "vertical")
            setFrameSize(child, innerW, frameHeight(child));
          else setFrameSize(child, frameWidth(child), innerH);
        }
        const self = readItemPolicy(child).alignSelf;
        if (self === "stretch") {
          if (constraint.direction === "vertical")
            setFrameSize(child, innerW, frameHeight(child));
          else setFrameSize(child, frameWidth(child), innerH);
        }
      }

      const sizes = children.map((c) =>
        constraint.direction === "vertical" ? frameHeight(c) : frameWidth(c),
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
          setTranslate(
            child,
            alignCross(
              crossAlign,
              frameWidth(parent),
              frameWidth(child),
              pad.left,
              pad.right,
            ),
            cursor,
          );
          cursor += frameHeight(child) + between;
        } else {
          setTranslate(
            child,
            cursor,
            alignCross(
              crossAlign,
              frameHeight(parent),
              frameHeight(child),
              pad.top,
              pad.bottom,
            ),
          );
          cursor += frameWidth(child) + between;
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
          frameWidth(child),
          frameHeight(child),
        );
        const col = index % constraint.columns;
        const row = Math.floor(index / constraint.columns);
        setTranslate(
          child,
          col * (frameWidth(child) + gapX),
          row * (frameHeight(child) + gapY),
        );
      });
      return;
    }
    case "align": {
      for (const child of children) {
        let x = translateX(child);
        let y = translateY(child);
        if (constraint.axis === "x" || constraint.axis === "both") {
          x = alignAxis(
            constraint.align,
            frameWidth(parent),
            frameWidth(child),
            0,
          );
        }
        if (constraint.axis === "y" || constraint.axis === "both") {
          y = alignAxis(
            constraint.align,
            frameHeight(parent),
            frameHeight(child),
            0,
          );
        }
        setTranslate(child, x, y);
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
