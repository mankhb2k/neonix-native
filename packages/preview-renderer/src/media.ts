import type { RenderMediaFit, RenderNormalizedRect } from "@motionvideo/motion-runtime";
import { fitMode } from "./math";

export type MediaLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  uv: RenderNormalizedRect;
};

export function mediaLayout(
  boxWidth: number,
  boxHeight: number,
  assetWidth: number,
  assetHeight: number,
  fit: RenderMediaFit | undefined,
  crop: RenderNormalizedRect | undefined,
): MediaLayout {
  const source = crop ?? { x: 0, y: 0, width: 1, height: 1 };
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
