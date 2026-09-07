import { fail } from "./errors";
import { edges, number, type CssViewport } from "./values";
import { parseAspectRatio, parseBorderEdges } from "./paint";
import { makeLayoutBox, type LayoutBox } from "./layout-ir";
import type { Style } from "./model";

export type GeometryEdges = [top: number, right: number, bottom: number, left: number];

export type ResolvedGeometry = {
  x: number;
  y: number;
  /** Position before relative offsets; used to advance normal flow. */
  normalX: number;
  normalY: number;
  width: number;
  height: number;
  contentWidth: number;
  contentHeight: number;
  padding: GeometryEdges;
  borderEdges: GeometryEdges;
  borderWidth: number;
  boxSizing: "content-box" | "border-box";
  /** Canonical P1 layout IR consumed by the lowering phase. */
  layoutBox: LayoutBox;
};

/** Reframes a resolved box after a parent layout algorithm assigns its slot. */
export function resizeResolvedGeometry(geometry: ResolvedGeometry, rect: { x: number; y: number; width: number; height: number }): ResolvedGeometry {
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const horizontalDecorations = geometry.padding[1] + geometry.padding[3] + geometry.borderEdges[1] + geometry.borderEdges[3];
  const verticalDecorations = geometry.padding[0] + geometry.padding[2] + geometry.borderEdges[0] + geometry.borderEdges[2];
  const contentWidth = Math.max(0, width - horizontalDecorations);
  const contentHeight = Math.max(0, height - verticalDecorations);
  const reframed = { x: rect.x, y: rect.y, width, height };
  return {
    ...geometry,
    x: rect.x,
    y: rect.y,
    normalX: rect.x,
    normalY: rect.y,
    width,
    height,
    contentWidth,
    contentHeight,
    layoutBox: makeLayoutBox(reframed, {
      x: rect.x + geometry.borderEdges[3] + geometry.padding[3],
      y: rect.y + geometry.borderEdges[0] + geometry.padding[0],
      width: contentWidth,
      height: contentHeight,
    }),
  };
}

type GeometryInput = {
  style: Style;
  parentX: number;
  parentY: number;
  containingWidth: number;
  containingHeight: number;
  fontSize: number;
  viewport: CssViewport;
};

function constraintValue(style: Style, property: string, relative: number, fontSize: number, viewport: CssViewport, fallback: number): number {
  const value = style.get(property);
  if (value === undefined || value.trim().toLowerCase() === "auto") return fallback;
  if (value.trim().toLowerCase() === "none") return Number.POSITIVE_INFINITY;
  const resolved = number(style, property, relative, fontSize, 16, viewport);
  if (!Number.isFinite(resolved) || resolved < 0) fail("css-size-invalid", `${property} must resolve to a non-negative length: ${value}`);
  return resolved;
}

function clampSize(value: number, min: number, max: number): number {
  // CSS resolves a conflicting min/max pair in favor of the minimum.
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function validateSize(value: number, property: string, raw: string | undefined): number {
  if (!Number.isFinite(value) || value < 0) fail("css-size-invalid", `${property} must resolve to a non-negative length: ${raw ?? "auto"}`);
  return value;
}

export function resolveGeometry(input: GeometryInput): ResolvedGeometry {
  const { style, parentX, parentY, containingWidth, containingHeight, fontSize, viewport } = input;
  const valueViewport = { ...viewport, containerWidth: containingWidth, containerHeight: containingHeight };
  const padding = edges(style, "padding", containingWidth, fontSize, 16, valueViewport);
  const border = parseBorderEdges(style, containingWidth, fontSize, valueViewport);
  const borderEdges: GeometryEdges = [border.top.width, border.right.width, border.bottom.width, border.left.width];
  const borderWidth = Math.max(...borderEdges);
  const horizontalDecorations = padding[1] + padding[3] + borderEdges[1] + borderEdges[3];
  const verticalDecorations = padding[0] + padding[2] + borderEdges[0] + borderEdges[2];
  const boxSizingValue = (style.get("box-sizing") ?? "content-box").trim().toLowerCase();
  if (boxSizingValue !== "content-box" && boxSizingValue !== "border-box") fail("css-box-sizing-invalid", `box-sizing supports content-box or border-box: ${boxSizingValue}`);
  const boxSizing = boxSizingValue as "content-box" | "border-box";

  const margin = edges(style, "margin", containingWidth, fontSize, 16, valueViewport);
  const position = (style.get("position") ?? "static").toLowerCase();
  const left = number(style, "left", containingWidth, fontSize, 16, valueViewport);
  const right = number(style, "right", containingWidth, fontSize, 16, valueViewport);
  const top = number(style, "top", containingHeight, fontSize, 16, valueViewport);
  const bottom = number(style, "bottom", containingHeight, fontSize, 16, valueViewport);
  const normalX = parentX + margin[3];
  const normalY = parentY + margin[0];

  const declaredWidth = number(style, "width", containingWidth, fontSize, 16, valueViewport);
  const declaredHeight = number(style, "height", containingHeight, fontSize, 16, valueViewport);
  const widthAuto = !Number.isFinite(declaredWidth);
  const heightAuto = !Number.isFinite(declaredHeight);
  const absoluteWidthFromInsets = position === "absolute" && Number.isFinite(left) && Number.isFinite(right);
  const absoluteHeightFromInsets = position === "absolute" && Number.isFinite(top) && Number.isFinite(bottom);
  const availableBorderWidth = Math.max(
    0,
    containingWidth - margin[1] - margin[3] - (absoluteWidthFromInsets ? left + right : 0),
  );
  const availableBorderHeight = Math.max(
    0,
    containingHeight - margin[0] - margin[2] - (absoluteHeightFromInsets ? top + bottom : 0),
  );
  const availableContentWidth = Math.max(0, availableBorderWidth - horizontalDecorations);
  const availableContentHeight = Math.max(0, availableBorderHeight - verticalDecorations);

  // width/height describe the content box under content-box and the border
  // box under border-box. Keep that sizing box through aspect-ratio and
  // min/max resolution, then derive the final border-box frame.
  let sizingWidth = widthAuto
    ? boxSizing === "border-box" ? availableBorderWidth : availableContentWidth
    : validateSize(declaredWidth, "width", style.get("width"));
  let sizingHeight = heightAuto
    ? boxSizing === "border-box" ? availableBorderHeight : availableContentHeight
    : validateSize(declaredHeight, "height", style.get("height"));

  const ratio = parseAspectRatio(style.get("aspect-ratio"));
  if (ratio !== undefined) {
    if (widthAuto && !heightAuto) sizingWidth = sizingHeight * ratio;
    else if (!widthAuto && heightAuto) sizingHeight = sizingWidth / ratio;
    else if (widthAuto && heightAuto) sizingHeight = sizingWidth / ratio;
  }

  const minWidth = constraintValue(style, "min-width", containingWidth, fontSize, valueViewport, 0);
  const maxWidth = constraintValue(style, "max-width", containingWidth, fontSize, valueViewport, Number.POSITIVE_INFINITY);
  const minHeight = constraintValue(style, "min-height", containingHeight, fontSize, valueViewport, 0);
  const maxHeight = constraintValue(style, "max-height", containingHeight, fontSize, valueViewport, Number.POSITIVE_INFINITY);
  sizingWidth = clampSize(validateSize(sizingWidth, "width", style.get("width")), minWidth, maxWidth);
  sizingHeight = clampSize(validateSize(sizingHeight, "height", style.get("height")), minHeight, maxHeight);

  const borderBoxWidth = Math.max(1, sizingWidth + (boxSizing === "content-box" ? horizontalDecorations : 0));
  const borderBoxHeight = Math.max(1, sizingHeight + (boxSizing === "content-box" ? verticalDecorations : 0));

  // Static positioning ignores inset properties. Relative positioning keeps
  // the normal-flow slot, then offsets the painted box from that slot. An
  // absolute box is removed from flow and uses its containing block directly.
  let requestedX = normalX;
  let requestedY = normalY;
  if (position === "relative") {
    const offsetX = Number.isFinite(left) ? left : Number.isFinite(right) ? -right : 0;
    const offsetY = Number.isFinite(top) ? top : Number.isFinite(bottom) ? -bottom : 0;
    requestedX += offsetX;
    requestedY += offsetY;
  } else if (position === "absolute") {
    requestedX = Number.isFinite(left)
      ? parentX + left + margin[3]
      : Number.isFinite(right)
        ? parentX + containingWidth - right - margin[1] - borderBoxWidth
        : normalX;
    requestedY = Number.isFinite(top)
      ? parentY + top + margin[0]
      : Number.isFinite(bottom)
        ? parentY + containingHeight - bottom - margin[2] - borderBoxHeight
        : normalY;
  }
  const contentWidth = Math.max(0, borderBoxWidth - horizontalDecorations);
  const contentHeight = Math.max(0, borderBoxHeight - verticalDecorations);
  return {
    // Keep the CSS layout box intact even when it crosses the composition
    // edge. The renderer's composition surface performs the final clip;
    // clamping here would change mask/background reference geometry and make
    // an overflowing element differ from browser CSS.
    x: requestedX,
    y: requestedY,
    normalX,
    normalY,
    width: borderBoxWidth,
    height: borderBoxHeight,
    contentWidth,
    contentHeight,
    padding,
    borderEdges,
    borderWidth,
    boxSizing,
    layoutBox: makeLayoutBox(
      { x: requestedX, y: requestedY, width: borderBoxWidth, height: borderBoxHeight },
      { x: requestedX + borderEdges[3] + padding[3], y: requestedY + borderEdges[0] + padding[0], width: contentWidth, height: contentHeight },
    ),
  };
}
