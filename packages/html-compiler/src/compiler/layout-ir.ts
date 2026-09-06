/** Renderer-independent rectangles used by the HTML/CSS layout phase. */
export type LayoutRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutBox = LayoutRect & {
  /** Origin and size of the content box in composition coordinates. */
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
};

export type LayoutContext = {
  containingBlock: LayoutRect;
  availableWidth: number;
  availableHeight: number;
};

export function compositionRect(width: number, height: number): LayoutRect {
  return { x: 0, y: 0, width, height };
}

export function makeLayoutBox(rect: LayoutRect, content: LayoutRect): LayoutBox {
  return {
    ...rect,
    contentX: content.x,
    contentY: content.y,
    contentWidth: content.width,
    contentHeight: content.height,
  };
}

/** The containing block for positioned descendants is the parent's padding box. */
export function paddingBox(rect: LayoutRect, borderWidth: number | [number, number, number, number]): LayoutRect {
  const [top, right, bottom, left] = typeof borderWidth === "number" ? [borderWidth, borderWidth, borderWidth, borderWidth] : borderWidth;
  return {
    x: rect.x + left,
    y: rect.y + top,
    width: Math.max(1, rect.width - left - right),
    height: Math.max(1, rect.height - top - bottom),
  };
}

export function assertLayoutBox(box: LayoutBox): LayoutBox {
  const values = [box.x, box.y, box.width, box.height, box.contentX, box.contentY, box.contentWidth, box.contentHeight];
  if (!values.every(Number.isFinite) || values.some((value, index) => index >= 2 && value < 0)) {
    throw new Error("LayoutBox must contain finite non-negative geometry");
  }
  return box;
}
