import type { MotionLayer } from "@motionvideo/motion-protocol";
import { getTextPayloadPlain } from "@motionvideo/motion-protocol";
import {
  defaultTextMeasurementProvider,
  estimateTextSize,
  type TextMeasurementProvider,
} from "./text-layout";

type VisualLayer = Exclude<MotionLayer, { type: "audio" | "camera" }>;
type GroupLayer = Extract<VisualLayer, { type: "group" }>;
type LayoutConstraint = NonNullable<GroupLayer["layout"]>;
type LayoutItemPolicy = NonNullable<VisualLayer["layoutItem"]>;
type EdgeInsets = { top: number; right: number; bottom: number; left: number };
type MutableNode = VisualLayer;

function isVisualLayer(layer: MotionLayer): layer is VisualLayer {
  return layer.type !== "audio" && layer.type !== "camera";
}

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
  return node.layoutItem ?? {};
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
  if (widthMode === "hug") width = intrinsic.width;
  if (widthMode === "fill") width = fillWidth;
  if (heightMode === "hug") height = intrinsic.height;
  if (heightMode === "fill") height = fillHeight;
  // Clamp after size mode, not instead of it.
  if (policy.minWidth != null) width = Math.max(policy.minWidth, width);
  if (policy.maxWidth != null) width = Math.min(policy.maxWidth, width);
  if (policy.minHeight != null) height = Math.max(policy.minHeight, height);
  if (policy.maxHeight != null) height = Math.min(policy.maxHeight, height);
  setFrameSize(child, width, height);
}

/**
 * Deterministic layout -> literal frame + translate.
 * Compile-time only: runtime IR must not keep `layout` / `layoutItem`.
 * v1 does not implement wrap, grow, shrink, or grid span/autoFlow.
 * min/max size clamps after fixed/hug/fill.
 */
export function applyLayoutConstraints(
  layers: MotionLayer[],
  measure: TextMeasurementProvider = defaultTextMeasurementProvider,
): MotionLayer[] {
  const byId = new Map(
    layers.filter(isVisualLayer).map((node) => [node.id, cloneNode(node)]),
  );
  const ordered = [...byId.values()];

  for (const parent of ordered) {
    if (parent.type !== "group" || !parent.layout) continue;
    const children = ordered.filter((node) => node.parentLayerId === parent.id);
    solveConstraint(parent, children, parent.layout, measure);
  }

  const visual = ordered.map((node) => stripLayoutFields(node));

  return layers.map((layer) => {
    if (layer.type === "audio") return layer;
    return visual.find((node) => node.id === layer.id) ?? layer;
  });
}

function stripLayoutFields(node: MutableNode): MutableNode {
  if (node.type === "group") {
    const { layout: _layout, layoutItem: _item, ...rest } = node;
    return rest;
  }
  const { layoutItem: _item, ...rest } = node;
  return rest;
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

  switch (constraint.mode) {
    case "row":
    case "column": {
      const isColumn = constraint.mode === "column";
      const gap = constraint.gap ?? 0;
      const pad = normalizePadding(
        constraint.padding as number | EdgeInsets | undefined,
      );
      const justify = constraint.justify ?? "start";
      const align = constraint.align ?? "start";
      const innerW = Math.max(0, frameWidth(parent) - pad.left - pad.right);
      const innerH = Math.max(0, frameHeight(parent) - pad.top - pad.bottom);

      for (const child of children) {
        applyItemSizing(child, readItemPolicy(child), measure, innerW, innerH);

        if (align === "stretch") {
          if (isColumn) setFrameSize(child, innerW, frameHeight(child));
          else setFrameSize(child, frameWidth(child), innerH);
        }

        const self = readItemPolicy(child).alignSelf;
        if (self === "stretch") {
          if (isColumn) setFrameSize(child, innerW, frameHeight(child));
          else setFrameSize(child, frameWidth(child), innerH);
        }
      }

      const sizes = children.map((child) =>
        isColumn ? frameHeight(child) : frameWidth(child),
      );
      const occupied =
        sizes.reduce((sum, size) => sum + size, 0) +
        gap * Math.max(0, children.length - 1);
      const free = Math.max(0, (isColumn ? innerH : innerW) - occupied);
      let cursor = isColumn
        ? pad.top +
          (justify === "center" ? free / 2 : justify === "end" ? free : 0)
        : pad.left +
          (justify === "center" ? free / 2 : justify === "end" ? free : 0);
      const between =
        justify === "space-between" && children.length > 1
          ? free / (children.length - 1)
          : gap;

      for (const child of children) {
        const policy = readItemPolicy(child);
        const crossAlign =
          policy.alignSelf && policy.alignSelf !== "auto"
            ? policy.alignSelf
            : align;

        if (isColumn) {
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
          continue;
        }

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
      return;
    }
    case "grid": {
      // Auto-flow: left-to-right, then top-to-bottom. No span / rowGap.
      const gap = constraint.gap ?? 0;
      const pad = normalizePadding(
        constraint.padding as number | EdgeInsets | undefined,
      );

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
          pad.left + col * (frameWidth(child) + gap),
          pad.top + row * (frameHeight(child) + gap),
        );
      });
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
  if (align === "end") {
    return Math.max(padStart, parentSize - childSize - padEnd);
  }
  return padStart;
}
