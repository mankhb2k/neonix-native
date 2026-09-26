/**
 * Emits an element's background paint layers (solid/gradient fills, with
 * deterministic tiling for a sized+repeated gradient) and background-image
 * layers (with deterministic tiling for a sized+repeated image). This is the
 * paint half of what `layout()` (compile.ts) used to inline directly - the
 * border half lives in border-node.ts, and both are called only after
 * compile.ts has already decided `needsPaintGroup`/`paintOpacity` and (if
 * needed) pushed the wrapping group layer, since that decision also depends
 * on outline/mask/filter/animation state this file doesn't own.
 */
import type { V2Paint, V2Track } from "@motionvideo/motion-protocol/v2";
import type { Node, Style } from "../model";
import type { Paint, CornerRadius } from "../paint/paint";
import type { LayoutRect } from "../layout/layout-ir";
import type { BackgroundImage, BackgroundSize } from "../paint/background";
import type { CompileClipPaths, CompileLayers } from "../compile-context";
import type { NodeTransformState } from "../transform/transform";
import { parseBackgroundBox, parseBackgroundPosition, parseBackgroundRepeat, parseBackgroundSize } from "../paint/background";
import { roundedRectContour } from "./shape-contours";
import { fail } from "../errors";

/**
 * Preserve CSS background-image's two coordinate systems for the common
 * repeat/repeat case: the element is the owner rect, while the gradient is
 * authored inside one background tile. Chromium rasterizes that tile first
 * and repeats the generated image over the owner. Protocol V2 already has a
 * pattern paint that represents the same contract.
 *
 * This is intentionally limited to zero-position, two-axis linear gradients
 * with a repeated background image. Other repeat modes still use the bounded lowering below until
 * their per-axis phase semantics are represented explicitly in the pattern
 * backend.
 */
function repeatLinearGradientPattern(
  fill: Paint,
  tileWidth: number,
  tileHeight: number,
  repeat: ReturnType<typeof parseBackgroundRepeat>,
  position: ReturnType<typeof parseBackgroundPosition>,
): V2Paint | undefined {
  if (
    typeof fill === "string" ||
    fill.type !== "linear-gradient" ||
    repeat !== "repeat" ||
    position.x !== 0 ||
    position.y !== 0
  ) return undefined;
  if (!Number.isFinite(tileWidth) || !Number.isFinite(tileHeight) || tileWidth <= 0 || tileHeight <= 0) return undefined;

  const angle = ((fill.angle ?? 0) * Math.PI) / 180;
  const tileLength = Math.abs(Math.cos(angle)) * tileWidth + Math.abs(Math.sin(angle)) * tileHeight;
  if (!Number.isFinite(tileLength) || tileLength <= 0) return undefined;

  const halfLength = tileLength / 2;
  const startX = tileWidth / 2 - Math.cos(angle) * halfLength;
  const startY = tileHeight / 2 - Math.sin(angle) * halfLength;
  const endX = tileWidth / 2 + Math.cos(angle) * halfLength;
  const endY = tileHeight / 2 + Math.sin(angle) * halfLength;

  const tileGradient = {
    ...fill,
    gradientUnits: "userSpaceOnUse" as const,
    x1: startX,
    y1: startY,
    x2: endX,
    y2: endY,
  } as Extract<V2Paint, { type: "linear-gradient" }>;

  return {
    type: "pattern",
    x: 0,
    y: 0,
    width: tileWidth,
    height: tileHeight,
    patternUnits: "userSpaceOnUse",
    patternContentUnits: "userSpaceOnUse",
    content: [{ type: "rect", x: 0, y: 0, width: tileWidth, height: tileHeight, fill: tileGradient }],
  };
}

/**
 * Re-resolve radial circle geometry in the local background-image tile.
 *
 * CSS resolves a background gradient inside its background-size image before
 * that image is repeated over the owner box. The parser initially receives
 * the owner box, so a `circle` farthest-corner radius can be normalized against
 * the wrong aspect ratio. A materialized tile must use its own dimensions.
 */
function resolveGradientForTile(fill: Paint, tileWidth: number, tileHeight: number): Paint {
  if (
    typeof fill === "string" ||
    fill.type !== "radial-gradient" ||
    fill.radius === undefined ||
    !Number.isFinite(tileWidth) ||
    !Number.isFinite(tileHeight) ||
    tileWidth <= 0 ||
    tileHeight <= 0
  ) return fill;

  const cx = fill.cx ?? 0.5;
  const cy = fill.cy ?? 0.5;
  const radius = Math.hypot(
    Math.max(cx * tileWidth, (1 - cx) * tileWidth),
    Math.max(cy * tileHeight, (1 - cy) * tileHeight),
  ) / Math.min(tileWidth, tileHeight);

  return Number.isFinite(radius) ? { ...fill, radius } : fill;
}

export type NodePaintInput = {
  style: Style;
  node: Node;
  viewport: { width: number; height: number };
  paints: Paint[];
  paintBoxFor: (index: number) => LayoutRect;
  backgroundImages: BackgroundImage[];
  boxFor: (box: ReturnType<typeof parseBackgroundBox>) => LayoutRect;
  cornerRadius: CornerRadius | undefined;
  needsPaintGroup: boolean;
  paintOpacity: number;
  groupId: string;
  parentId: string | null;
  zIndex: number | undefined;
  localX: number;
  localY: number;
  transformFor: NodeTransformState["transformFor"];
  state: Partial<{ enabled: boolean }>;
  duration: number;
  paintAnimationTracks: V2Track[];
  /** `layers.length` captured right after compile.ts pushed the optional wrapping group layer, before any paint/background-image/border layer - both this file and border-node.ts order their own layers relative to it. */
  paintLayerBaseOrder: number;
  layers: CompileLayers;
  clipPaths: CompileClipPaths;
  mediaAsset: (node: Node, kind: "image" | "video" | "audio", uri: string, suffix?: string) => string;
};

/** Emits every background paint layer (`paints`) and background-image layer (`backgroundImages`) this element has, each deterministically tiled when CSS background-repeat calls for it. */
export function emitNodePaint(input: NodePaintInput): void {
  const {
    style, node, viewport, paints, paintBoxFor, backgroundImages, boxFor, cornerRadius,
    needsPaintGroup, paintOpacity, groupId, parentId, zIndex, localX, localY, transformFor,
    state, duration, paintAnimationTracks, paintLayerBaseOrder, layers, clipPaths, mediaAsset,
  } = input;

  paints.forEach((fill, index) => {
    const paintId = paints.length === 1 ? (needsPaintGroup ? `${groupId}::paint` : groupId) : `${groupId}::paint:${index}`;
    const paintBox = paintBoxFor(index);
    // A CSS gradient used as a background image has two independent
    // coordinate systems: the gradient itself and the background image
    // tile. The old lowering kept only the gradient and painted it over
    // the complete element, silently dropping background-size and
    // background-repeat for shorthand backgrounds. Lower explicit
    // sized gradient tiles through the same bounded path as URL
    // backgrounds so the V2 contract remains deterministic for Skia.
    const isGradientPaint = typeof fill !== "string" && (
      fill.type === "linear-gradient" || fill.type === "radial-gradient" || fill.type === "conic-gradient"
    );
    const backgroundSize = isGradientPaint
      ? parseBackgroundSize(style, index, paintBox.width, paintBox.height, viewport)
      : { type: "auto" as const };
    const backgroundRepeat = isGradientPaint ? parseBackgroundRepeat(style, index) : "repeat" as const;
    const shouldTileGradient = isGradientPaint && backgroundSize.type === "length";
    // CSS background layers are painted back-to-front: the last
    // listed layer is underneath the first listed layer. Protocol V2
    // draws larger order values later, so reverse only this paint-layer
    // offset while keeping the source array and generated ids stable.
    const paintOrderOffset = paints.length > 1 ? paints.length - index - 1 : 0;
    const order = Number.isFinite(zIndex)
      ? Math.max(0, 100000 + (zIndex as number)) + paintOrderOffset
      : paintLayerBaseOrder + paintOrderOffset;
    const paintTransform = transformFor(needsPaintGroup ? paintBox.x : localX + paintBox.x, needsPaintGroup ? paintBox.y : localY + paintBox.y, !needsPaintGroup);
    if (shouldTileGradient && backgroundSize.type === "length") {
      const drawWidth = Math.max(1, backgroundSize.width);
      const drawHeight = Math.max(1, backgroundSize.height);
      const position = parseBackgroundPosition(style, index);
      const xRepeats = backgroundRepeat === "repeat" || backgroundRepeat === "repeat-x";
      const yRepeats = backgroundRepeat === "repeat" || backgroundRepeat === "repeat-y";
      const startX = paintBox.x + (paintBox.width - drawWidth) * position.x;
      const startY = paintBox.y + (paintBox.height - drawHeight) * position.y;
      const rectRepeatFill = repeatLinearGradientPattern(fill, drawWidth, drawHeight, backgroundRepeat, position);
      if (rectRepeatFill) {
        layers.push({
          id: paintId,
          type: "shape",
          parentLayerId: needsPaintGroup ? groupId : parentId,
          order,
          frame: { width: paintBox.width, height: paintBox.height },
          transform: paintTransform,
          opacity: paintOpacity,
          ...state,
          ...(paintAnimationTracks.length ? { tracks: paintAnimationTracks } : {}),
          timing: { start: 0, duration },
          payload: { shape: "rectangle" },
          style: { fill: rectRepeatFill },
        });
        return;
      }
      // Emit only tiles that intersect the background clip box. The
      // previous +/-1 overscan was useful for image sampling but creates
      // unnecessary layers and clip paths for deterministic CSS paints.
      const xStart = xRepeats ? Math.floor((paintBox.x - startX) / drawWidth) : 0;
      const xEnd = xRepeats ? Math.ceil((paintBox.x + paintBox.width - startX) / drawWidth) - 1 : 0;
      const yStart = yRepeats ? Math.floor((paintBox.y - startY) / drawHeight) : 0;
      const yEnd = yRepeats ? Math.ceil((paintBox.y + paintBox.height - startY) / drawHeight) - 1 : 0;
      const tileCount = Math.max(1, xEnd - xStart + 1) * Math.max(1, yEnd - yStart + 1);
      // Each bounded tile currently owns a clipPath in Protocol V2;
      // keep the generated document within the V2 clipPaths limit.
      if (tileCount > 256) fail("css-background-repeat-too-many-tiles", "background-repeat would generate more than 256 deterministic gradient tiles");
      let tileIndex = 0;
      for (let xTile = xStart; xTile <= xEnd; xTile += 1) for (let yTile = yStart; yTile <= yEnd; yTile += 1) {
        const tileX = startX + (xRepeats ? xTile * drawWidth : 0);
        const tileY = startY + (yRepeats ? yTile * drawHeight : 0);
        const clipId = `html-background-clip-${clipPaths.length}`;
        clipPaths.push({ id: clipId, clipPathUnits: "userSpaceOnUse", children: [{ type: "rect", x: paintBox.x - tileX, y: paintBox.y - tileY, width: paintBox.width, height: paintBox.height, ...(typeof cornerRadius === "number" ? { rx: cornerRadius, ry: cornerRadius } : {}) }] });
        layers.push({
          id: `${paintId}::tile:${tileIndex++}`,
          type: "shape",
          parentLayerId: needsPaintGroup ? groupId : parentId,
          order: (Number.isFinite(zIndex) ? Math.max(0, 100000 + (zIndex as number)) : paintLayerBaseOrder) + (paints.length - index - 1) * 10000 + tileIndex,
          frame: { width: drawWidth, height: drawHeight },
          transform: transformFor(needsPaintGroup ? tileX : localX + tileX, needsPaintGroup ? tileY : localY + tileY, false),
          opacity: paintOpacity,
          ...state,
          ...(paintAnimationTracks.length ? { tracks: paintAnimationTracks } : {}),
          clipPath: clipId,
          timing: { start: 0, duration },
          payload: { shape: "rectangle" },
          style: { fill: resolveGradientForTile(fill, drawWidth, drawHeight) },
        });
      }
      return;
    }
    if (typeof cornerRadius === "object") {
      // A rounded CSS background is one painted element. Do not split
      // it into overlapping rectangle/ellipse atoms: each atom would
      // source-over the same semi-transparent fill and make opacity
      // depend on the number of generated pieces. A single contour
      // preserves the browser's one-element compositing boundary.
      layers.push({
        id: paintId,
        type: "path",
        parentLayerId: needsPaintGroup ? groupId : parentId,
        order,
        frame: { width: paintBox.width, height: paintBox.height },
        transform: paintTransform,
        opacity: paintOpacity,
        ...state,
        ...(paintAnimationTracks.length ? { tracks: paintAnimationTracks } : {}),
        timing: { start: 0, duration },
        payload: { contours: [roundedRectContour(paintBox.width, paintBox.height, cornerRadius)], fillRule: "nonzero" },
        style: { fill },
      });
    }
    else layers.push({ id: paintId, type: "shape", parentLayerId: needsPaintGroup ? groupId : parentId, order, frame: { width: paintBox.width, height: paintBox.height }, transform: paintTransform, opacity: paintOpacity, ...state, ...(paintAnimationTracks.length ? { tracks: paintAnimationTracks } : {}), timing: { start: 0, duration }, payload: { shape: "rectangle", ...(cornerRadius === undefined ? {} : { cornerRadius }) }, style: { fill } });
  });
  if (backgroundImages.length > 0) {
    const alignFor = (position: ReturnType<typeof parseBackgroundPosition>) => `${position.x === 0 ? "xMin" : position.x === 1 ? "xMax" : "xMid"}${position.y === 0 ? "YMin" : position.y === 1 ? "YMax" : "YMid"}` as "xMinYMin" | "xMidYMin" | "xMaxYMin" | "xMinYMid" | "xMidYMid" | "xMaxYMid" | "xMinYMax" | "xMidYMax" | "xMaxYMax";
    const emitBackgroundLayer = (image: BackgroundImage, imageIndex: number, tileIndex: number, drawX: number, drawY: number, drawWidth: number, drawHeight: number, fit: "none" | "contain" | "cover" | "fill", align: ReturnType<typeof alignFor>, clipBox: LayoutRect) => {
      const clipId = `html-background-clip-${clipPaths.length}`;
      clipPaths.push({ id: clipId, clipPathUnits: "userSpaceOnUse", children: [{ type: "rect", x: clipBox.x - drawX, y: clipBox.y - drawY, width: clipBox.width, height: clipBox.height, ...(typeof cornerRadius === "number" ? { rx: cornerRadius, ry: cornerRadius } : {}) }] });
      const orderBase = Number.isFinite(zIndex) ? Math.max(0, 100000 + (zIndex as number)) : paintLayerBaseOrder + paints.length;
      const order = orderBase + (backgroundImages.length - imageIndex) * 10000 + tileIndex;
      const id = `${groupId}::background:${imageIndex}${tileIndex === 0 ? "" : `:${tileIndex}`}`;
      const parentLayerId = groupId;
      if (image.type === "paint" || image.type === "color") {
        layers.push({ id, type: "shape", parentLayerId, order, frame: { width: drawWidth, height: drawHeight }, transform: transformFor(drawX, drawY, false), opacity: paintOpacity * (image.opacity ?? 1), ...state, clipPath: clipId, timing: { start: 0, duration }, payload: { shape: "rectangle" }, style: { fill: image.type === "paint" ? image.paint : image.color } });
        return;
      }
      const preserveAspectRatio = fit === "fill" ? { align: "none" as const } : { align, ...(fit === "cover" ? { meetOrSlice: "slice" as const } : fit === "contain" ? { meetOrSlice: "meet" as const } : {}) };
      layers.push({ id, type: "image", parentLayerId, order, frame: { width: drawWidth, height: drawHeight }, transform: transformFor(drawX, drawY, false), opacity: paintOpacity * (image.opacity ?? 1), ...state, clipPath: clipId, timing: { start: 0, duration }, payload: { assetId: mediaAsset(node, "image", image.uri, `background-${imageIndex}-${tileIndex}-asset`), x: 0, y: 0, width: drawWidth, height: drawHeight, fit, preserveAspectRatio } });
    };
    backgroundImages.forEach((image, imageIndex) => {
      const origin = boxFor(parseBackgroundBox(style, "background-origin", imageIndex));
      const clipBox = boxFor(parseBackgroundBox(style, "background-clip", imageIndex));
      const position = parseBackgroundPosition(style, imageIndex);
      const rawSize = parseBackgroundSize(style, imageIndex, origin.width, origin.height, viewport);
      const repeat = parseBackgroundRepeat(style, imageIndex);
      // A CSS <gradient> (or the plain-color fallback of an unsupported
      // image()) has no unknown intrinsic size the way a raster/url() image
      // does: its generated image is defined by spec to exactly fill the
      // background positioning area whenever background-size is auto.
      // Repeating that box-sized tile is fully deterministic without an
      // explicit size, unlike repeating an asset of unknown pixel dimensions.
      const size: BackgroundSize = rawSize.type === "length" || image.type === "asset"
        ? rawSize
        : { type: "length", width: origin.width, height: origin.height };
      if (repeat !== "no-repeat" && size.type !== "length") fail("css-background-repeat-needs-size", "Repeating a background image requires an explicit two-dimensional background-size in the deterministic compiler");
      if (size.type === "length") {
        const drawWidth = Math.max(1, size.width); const drawHeight = Math.max(1, size.height);
        const startX = origin.x + (origin.width - drawWidth) * position.x; const startY = origin.y + (origin.height - drawHeight) * position.y;
        const xRepeats = repeat === "repeat" || repeat === "repeat-x"; const yRepeats = repeat === "repeat" || repeat === "repeat-y";
        const xStart = xRepeats ? Math.floor((clipBox.x - startX) / drawWidth) - 1 : 0; const xEnd = xRepeats ? Math.ceil((clipBox.x + clipBox.width - startX) / drawWidth) + 1 : 0;
        const yStart = yRepeats ? Math.floor((clipBox.y - startY) / drawHeight) - 1 : 0; const yEnd = yRepeats ? Math.ceil((clipBox.y + clipBox.height - startY) / drawHeight) + 1 : 0;
        const tileCount = Math.max(1, xEnd - xStart + 1) * Math.max(1, yEnd - yStart + 1);
        if (tileCount > 4096) fail("css-background-repeat-too-many-tiles", "background-repeat would generate more than 4096 deterministic image tiles");
        let tileIndex = 0;
        for (let xTile = xStart; xTile <= xEnd; xTile += 1) for (let yTile = yStart; yTile <= yEnd; yTile += 1) {
          emitBackgroundLayer(image, imageIndex, tileIndex++, startX + (xRepeats ? xTile * drawWidth : 0), startY + (yRepeats ? yTile * drawHeight : 0), drawWidth, drawHeight, "fill", "xMinYMin", clipBox);
        }
        return;
      }
      const fit = size.type === "cover" ? "cover" : size.type === "contain" ? "contain" : "none";
      const align = alignFor(position);
      emitBackgroundLayer(image, imageIndex, 0, origin.x, origin.y, origin.width, origin.height, fit, align, clipBox);
    });
  }
}
