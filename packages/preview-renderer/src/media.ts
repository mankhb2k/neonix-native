import type {
  RenderImageAlign,
  RenderImagePreserveAspectRatio,
  RenderMediaFit,
  RenderNormalizedRect,
} from "@motionvideo/motion-runtime";
import { fitMode } from "./math";

export type MediaLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  uv: RenderNormalizedRect;
};

function alignFactors(align: RenderImageAlign): { x: number; y: number } {
  return {
    x: align.includes("xMin") ? 0 : align.includes("xMax") ? 1 : 0.5,
    y: align.includes("YMin") ? 0 : align.includes("YMax") ? 1 : 0.5,
  };
}

/** Resolves SVG <image> preserveAspectRatio into a quad and source UV rect. */
export function imageLayout(
  boxWidth: number,
  boxHeight: number,
  assetWidth: number,
  assetHeight: number,
  x: number,
  y: number,
  preserveAspectRatio: RenderImagePreserveAspectRatio | undefined,
  fit?: RenderMediaFit,
): MediaLayout {
  const align = preserveAspectRatio?.align ?? "xMidYMid";
  const factors = alignFactors(align);
  if (fit === "none") {
    return {
      x: x + (boxWidth - assetWidth) * factors.x,
      y: y + (boxHeight - assetHeight) * factors.y,
      width: assetWidth,
      height: assetHeight,
      uv: { x: 0, y: 0, width: 1, height: 1 },
    };
  }
  if (align === "none") {
    return { x, y, width: boxWidth, height: boxHeight, uv: { x: 0, y: 0, width: 1, height: 1 } };
  }

  const meetOrSlice = preserveAspectRatio?.meetOrSlice ?? "meet";
  const scale = meetOrSlice === "slice"
    ? Math.max(boxWidth / assetWidth, boxHeight / assetHeight)
    : Math.min(boxWidth / assetWidth, boxHeight / assetHeight);
  const drawWidth = assetWidth * scale;
  const drawHeight = assetHeight * scale;
  if (meetOrSlice === "slice") {
    const uvWidth = boxWidth / drawWidth;
    const uvHeight = boxHeight / drawHeight;
    return {
      x,
      y,
      width: boxWidth,
      height: boxHeight,
      uv: {
        x: (1 - uvWidth) * factors.x,
        y: (1 - uvHeight) * factors.y,
        width: uvWidth,
        height: uvHeight,
      },
    };
  }

  return {
    x: x + (boxWidth - drawWidth) * factors.x,
    y: y + (boxHeight - drawHeight) * factors.y,
    width: drawWidth,
    height: drawHeight,
    uv: { x: 0, y: 0, width: 1, height: 1 },
  };
}

export function mediaLayout(
  boxWidth: number,
  boxHeight: number,
  assetWidth: number,
  assetHeight: number,
  fit: RenderMediaFit | undefined,
): MediaLayout {
  const source = { x: 0, y: 0, width: 1, height: 1 };
  const sourceWidth = Math.max(assetWidth * source.width, 1);
  const sourceHeight = Math.max(assetHeight * source.height, 1);
  const sourceAspect = sourceWidth / sourceHeight;
  const boxAspect = Math.max(boxWidth, 1) / Math.max(boxHeight, 1);
  const mode = fitMode(fit);

  if (mode === "none") {
    return {
      x: (boxWidth - sourceWidth) / 2,
      y: (boxHeight - sourceHeight) / 2,
      width: sourceWidth,
      height: sourceHeight,
      uv: source,
    };
  }

  if (mode === "contain") {
    const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    return { x: (boxWidth - width) / 2, y: (boxHeight - height) / 2, width, height, uv: source };
  }

  if (mode === "cover") {
    let uvWidth = source.width;
    let uvHeight = source.height;
    if (boxAspect > sourceAspect) uvHeight = source.width * assetWidth / (boxAspect * assetHeight);
    else uvWidth = sourceHeight * boxAspect / assetWidth;
    return {
      x: 0,
      y: 0,
      width: boxWidth,
      height: boxHeight,
      uv: {
        x: source.x + (source.width - uvWidth) / 2,
        y: source.y + (source.height - uvHeight) / 2,
        width: uvWidth,
        height: uvHeight,
      },
    };
  }

  return { x: 0, y: 0, width: boxWidth, height: boxHeight, uv: source };
}
