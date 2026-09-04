import { fail } from "./errors";
import { edges, number } from "./values";
import { parseAspectRatio, parseBorder } from "./paint";
import { constrainToComposition } from "./layout";
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
  borderWidth: number;
  boxSizing: "content-box" | "border-box";
};

type GeometryInput = {
  style: Style;
  parentX: number;
  parentY: number;
  containingWidth: number;
  containingHeight: number;
  fontSize: number;
  viewport: { width: number; height: number };
};

function constraintValue(style: Style, property: string, relative: number, fontSize: number, viewport: { width: number; height: number }, fallback: number): number {
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
  const padding = edges(style, "padding", containingWidth, fontSize, 16, viewport);
  const border = parseBorder(style, containingWidth, fontSize, viewport);
  const borderWidth = border.width ?? 0;
  const horizontalDecorations = padding[1] + padding[3] + borderWidth * 2;
  const verticalDecorations = padding[0] + padding[2] + borderWidth * 2;
  const boxSizingValue = (style.get("box-sizing") ?? "content-box").trim().toLowerCase();
  if (boxSizingValue !== "content-box" && boxSizingValue !== "border-box") fail("css-box-sizing-invalid", `box-sizing supports content-box or border-box: ${boxSizingValue}`);
  const boxSizing = boxSizingValue as "content-box" | "border-box";

  const margin = edges(style, "margin", containingWidth, fontSize, 16, viewport);
  const position = (style.get("position") ?? "static").toLowerCase();
  const left = number(style, "left", containingWidth, fontSize, 16, viewport);
  const right = number(style, "right", containingWidth, fontSize, 16, viewport);
  const top = number(style, "top", containingHeight, fontSize, 16, viewport);
  const bottom = number(style, "bottom", containingHeight, fontSize, 16, viewport);
  const normalX = parentX + margin[3];
  const normalY = parentY + margin[0];

  const declaredWidth = number(style, "width", containingWidth, fontSize, 16, viewport);
  const declaredHeight = number(style, "height", containingHeight, fontSize, 16, viewport);
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

  const minWidth = constraintValue(style, "min-width", containingWidth, fontSize, viewport, 0);
  const maxWidth = constraintValue(style, "max-width", containingWidth, fontSize, viewport, Number.POSITIVE_INFINITY);
  const minHeight = constraintValue(style, "min-height", containingHeight, fontSize, viewport, 0);
  const maxHeight = constraintValue(style, "max-height", containingHeight, fontSize, viewport, Number.POSITIVE_INFINITY);
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
  const bounded = constrainToComposition(requestedX, requestedY, borderBoxWidth, borderBoxHeight, viewport.width, viewport.height);

  return {
    x: bounded.x,
    y: bounded.y,
    normalX,
    normalY,
    width: bounded.width,
    height: bounded.height,
    contentWidth,
    contentHeight,
    padding,
    borderWidth,
    boxSizing,
  };
}
