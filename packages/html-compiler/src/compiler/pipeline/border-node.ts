/**
 * Emits an element's CSS border - every style (solid/dashed/dotted/double/
 * groove/ridge/inset/outset), uniform or per-side, sharp or rounded corners.
 * This is the border half of what `layout()` (compile.ts) used to inline
 * directly; the background-paint half lives in paint-node.ts. Several
 * branches here are pixel-matched against real Chrome (see the comments
 * inline) - kept verbatim from the pre-extraction code rather than rewritten,
 * to not risk that parity while moving it.
 */
import type { MotionProtocolV2, V2Track } from "@motionvideo/motion-protocol/v2";
import type { LayoutRect } from "../layout-ir";
import type { CornerRadius } from "../paint";
import type { parseBorderEdges } from "../paint";
import type { CompileLayers } from "../compile-context";
import type { NodeTransformState } from "../transform";
import { borderBand, borderRegion, circlePolygon, clipConvexPolygon, fitBorderDashRuns, shadeBorderColor } from "./border/geometry";
import { buildRoundedDashRuns, buildRoundedDotRuns } from "./border/rounded-dash";
import { rectangleContour, roundedRectContour } from "./shape-contours";

export type NodeBorderInput = {
  border: ReturnType<typeof parseBorderEdges>;
  borderBox: LayoutRect;
  cornerRadius: CornerRadius | undefined;
  zIndex: number | undefined;
  /** `layers.length` right after compile.ts pushed the optional wrapping group layer - the same base paint-node.ts orders its own paint/background-image layers relative to, used here only for the borderOrder fallback when there's no z-index. */
  paintLayerBaseOrder: number;
  paintsCount: number;
  backgroundImagesCount: number;
  groupId: string;
  parentId: string | null;
  needsPaintGroup: boolean;
  localX: number;
  localY: number;
  transformFor: NodeTransformState["transformFor"];
  paintOpacity: number;
  state: Partial<{ enabled: boolean }>;
  duration: number;
  borderAnimationTracks: V2Track[];
  layers: CompileLayers;
};

/** Emits this element's full border - picks the cheapest correct representation (one rounded-rect stroke, a dashed/dotted rounded-rect contour, four filled trapezoids for unequal solid sides, or a full per-side/per-style breakdown) rather than always falling back to the general per-side path. */
export function emitNodeBorder(input: NodeBorderInput): void {
  const {
    border, borderBox, cornerRadius, zIndex, paintLayerBaseOrder, paintsCount, backgroundImagesCount,
    groupId, parentId, needsPaintGroup, localX, localY, transformFor, paintOpacity, state, duration,
    borderAnimationTracks, layers,
  } = input;

  const uniformBorder = Object.values(border).every((side) => side.style === "solid" && side.width === Object.values(border)[0]!.width && side.color === Object.values(border)[0]!.color);
  const inset = uniformBorder ? Object.values(border)[0]!.width / 2 : 0;
  const borderWidth = Math.max(1, borderBox.width - (uniformBorder ? Object.values(border)[0]!.width : 0));
  const borderHeight = Math.max(1, borderBox.height - (uniformBorder ? Object.values(border)[0]!.width : 0));
  const borderOrder = Number.isFinite(zIndex)
    ? Math.max(0, 100000 + (zIndex as number)) + 1000000
    : paintLayerBaseOrder + paintsCount + backgroundImagesCount * 100000 + 1000;
  const borderId = `${groupId}::border`;
  // A rounded dashed/dotted border cannot be lowered to the
  // discrete-polygon-per-run trick used for the sharp-corner case
  // (fitBorderDashRuns): once the perimeter has arcs, the border
  // is one continuous curved path, so it must carry a real
  // strokeDash the same way SVG stroke-dasharray does. Reuse the
  // exact geometry the solid-uniform-radius branches already use
  // below (shape+cornerRadius for a simple numeric radius,
  // roundedRectContour for the elliptical/per-corner object
  // form) so the border footprint matches pixel-for-pixel; only
  // the paint (stroke -> dashed stroke) differs.
  const uniformDashedBorder = (border.top.style === "dashed" || border.top.style === "dotted")
    && Object.values(border).every((side) => side.style === border.top.style && side.width === border.top.width && side.color === border.top.color);
  if (uniformDashedBorder && typeof cornerRadius === "object") {
    const runs = border.top.style === "dotted"
      ? buildRoundedDotRuns(borderBox.width, borderBox.height, cornerRadius, border.top.width)
      : buildRoundedDashRuns(borderBox.width, borderBox.height, cornerRadius, border.top.width);
    layers.push({
      id: borderId,
      type: "path",
      parentLayerId: needsPaintGroup ? groupId : parentId,
      order: borderOrder,
      frame: { width: borderBox.width, height: borderBox.height },
      transform: transformFor(needsPaintGroup ? 0 : localX, needsPaintGroup ? 0 : localY, !needsPaintGroup),
      opacity: paintOpacity,
      ...state,
      ...(borderAnimationTracks.length ? { tracks: borderAnimationTracks } : {}),
      timing: { start: 0, duration },
      payload: { contours: runs },
      style: { fill: "none", stroke: border.top.color, strokeWidth: border.top.width, strokeCap: border.top.style === "dotted" ? "round" : "butt" },
    } as Extract<MotionProtocolV2["layers"][number], { type: "path" }>);
  }
  else if (uniformDashedBorder && typeof cornerRadius === "number" && cornerRadius > 0) {
    // Literal pre-baked geometry (see rounded-dash.ts) instead of a
    // runtime strokeDash cycled around a closed rounded-rect path:
    // CanvasKit's SkPathEffect::MakeDash reproducibly corrupts one
    // dash at a line-to-cubic verb transition on a closed bezier
    // path (isolated via the debug/svg-rounded-rect-dash-isolation
    // fixture, independent of html-compiler's own math), so the
    // fix is to never hand CanvasKit a closed path + PathEffect
    // for this case at all.
    // Matches Chrome's own ContouredBorderGeometry::PixelSnapped
    // ContouredBorderWithOutsets exactly: a plain radius-width/2
    // subtraction with no positive floor (FloatRoundedRect::Radii
    // ::Outset), stroked with the default miter join (cc::PaintFlags
    // ::kDefault_Join). When cornerRadius <= strokeInset this
    // collapses to a sharp, square corner in the REAL browser too --
    // not a bug, confirmed by reading Blink's source (see
    // D:\NextJS\chromium-reference) and pixel-comparing against a
    // fresh Chrome capture. Chromium even tracks this as a known
    // rough edge for tight corners (box_border_painter.cc, crbug.com
    // /41089993), so matching it here (not "fixing" it) is what
    // keeps CanvasKit at 1:1 parity with the browser.
    const strokeInset = border.top.width / 2;
    const strokeWidth = Math.max(1, borderBox.width - border.top.width);
    const strokeHeight = Math.max(1, borderBox.height - border.top.width);
    const strokeRadius = Math.max(0, cornerRadius - strokeInset);
    const strokeRadii = {
      topLeft: { rx: strokeRadius, ry: strokeRadius },
      topRight: { rx: strokeRadius, ry: strokeRadius },
      bottomRight: { rx: strokeRadius, ry: strokeRadius },
      bottomLeft: { rx: strokeRadius, ry: strokeRadius },
    };
    const runs = border.top.style === "dotted"
      ? buildRoundedDotRuns(strokeWidth, strokeHeight, strokeRadii, border.top.width)
      : buildRoundedDashRuns(strokeWidth, strokeHeight, strokeRadii, border.top.width);
    layers.push({
      id: borderId,
      type: "path",
      parentLayerId: needsPaintGroup ? groupId : parentId,
      order: borderOrder,
      frame: { width: strokeWidth, height: strokeHeight },
      transform: transformFor(
        needsPaintGroup ? strokeInset : localX + strokeInset,
        needsPaintGroup ? strokeInset : localY + strokeInset,
        !needsPaintGroup,
      ),
      opacity: paintOpacity,
      ...state,
      ...(borderAnimationTracks.length ? { tracks: borderAnimationTracks } : {}),
      timing: { start: 0, duration },
      payload: { contours: runs },
      style: { fill: "none", stroke: border.top.color, strokeWidth: border.top.width, strokeCap: border.top.style === "dotted" ? "round" : "butt" },
    } as Extract<MotionProtocolV2["layers"][number], { type: "path" }>);
  }
  else if (uniformBorder && typeof cornerRadius === "object") layers.push({
    id: borderId,
    type: "path",
    parentLayerId: needsPaintGroup ? groupId : parentId,
    order: borderOrder,
    frame: { width: borderBox.width, height: borderBox.height },
    transform: transformFor(needsPaintGroup ? 0 : localX, needsPaintGroup ? 0 : localY, !needsPaintGroup),
    opacity: paintOpacity,
    ...state,
    ...(borderAnimationTracks.length ? { tracks: borderAnimationTracks } : {}),
    timing: { start: 0, duration },
    payload: { contours: [roundedRectContour(borderBox.width, borderBox.height, cornerRadius)] },
    style: { fill: "none", stroke: Object.values(border)[0]!.color, strokeWidth: Object.values(border)[0]!.width },
  } as Extract<MotionProtocolV2["layers"][number], { type: "path" }>);
  else if (uniformBorder && borderAnimationTracks.length > 0) layers.push({
    id: borderId,
    type: "path",
    parentLayerId: needsPaintGroup ? groupId : parentId,
    order: borderOrder,
    frame: { width: borderBox.width, height: borderBox.height },
    transform: transformFor(needsPaintGroup ? 0 : localX, needsPaintGroup ? 0 : localY, !needsPaintGroup),
    opacity: paintOpacity,
    ...state,
    tracks: borderAnimationTracks,
    timing: { start: 0, duration },
    payload: { contours: [rectangleContour(borderBox.width, borderBox.height, Object.values(border)[0]!.width / 2, `${borderId}:animated-contour`)] },
    style: { fill: "none", stroke: Object.values(border)[0]!.color, strokeWidth: Object.values(border)[0]!.width },
  } as Extract<MotionProtocolV2["layers"][number], { type: "path" }>);
  else if (uniformBorder) layers.push({
    id: borderId,
    type: "shape",
    parentLayerId: needsPaintGroup ? groupId : parentId,
    order: borderOrder,
    frame: { width: borderWidth, height: borderHeight },
    transform: transformFor(needsPaintGroup ? inset : localX + inset, needsPaintGroup ? inset : localY + inset, !needsPaintGroup),
    opacity: paintOpacity,
    ...state,
    ...(borderAnimationTracks.length ? { tracks: borderAnimationTracks } : {}),
    timing: { start: 0, duration },
    payload: { shape: "rectangle", ...(typeof cornerRadius === "number" ? { cornerRadius: Math.max(0, cornerRadius - inset) } : {}) },
    style: { fill: "#00000000", stroke: Object.values(border)[0]!.color, strokeWidth: Object.values(border)[0]!.width },
  });
  else if (
    Object.values(border).every((side) =>
      side.style === "double" &&
      side.width === Object.values(border)[0]!.width &&
      side.color === Object.values(border)[0]!.color,
    ) &&
    cornerRadius === undefined
  ) {
    const borderWidth = Object.values(border)[0]!.width;
    const strokeWidth = borderWidth / 3;
    const outerInset = strokeWidth / 2;
    const innerInset = borderWidth - outerInset;
    layers.push({
      id: borderId,
      type: "path",
      parentLayerId: needsPaintGroup ? groupId : parentId,
      order: borderOrder,
      frame: { width: borderBox.width, height: borderBox.height },
      transform: transformFor(needsPaintGroup ? 0 : localX, needsPaintGroup ? 0 : localY, !needsPaintGroup),
      opacity: paintOpacity,
      ...state,
      timing: { start: 0, duration },
      payload: {
        contours: [
          rectangleContour(borderBox.width, borderBox.height, outerInset, `${borderId}:outer`),
          rectangleContour(borderBox.width, borderBox.height, innerInset, `${borderId}:inner`),
        ],
      },
      style: {
        fill: "none",
        stroke: Object.values(border)[0]!.color,
        strokeWidth,
        strokeJoin: "miter",
        strokeCap: "butt",
      },
    } as Extract<MotionProtocolV2["layers"][number], { type: "path" }>);
  }
  else {
    const emitBorderSide = (side: "top" | "right" | "bottom" | "left", index: number) => {
      const config = border[side]; if (config.width <= 0 || config.style === "none") return;
      if (config.style === "groove" || config.style === "ridge" || config.style === "inset" || config.style === "outset") {
        const region = borderRegion(side, borderBox.width, borderBox.height, border.top.width, border.right.width, border.bottom.width, border.left.width);
        const light = shadeBorderColor(config.color, 0.28);
        const dark = shadeBorderColor(config.color, -0.28);
        const topOrLeft = side === "top" || side === "left";
        const pushBand = (bandIndex: number, from: number, to: number, color: string) => layers.push({
          id: `${borderId}:${side}:band-${bandIndex}`,
          type: "shape",
          parentLayerId: needsPaintGroup ? groupId : parentId,
          order: borderOrder + index * 100 + bandIndex,
          frame: { width: borderBox.width, height: borderBox.height },
          transform: transformFor(needsPaintGroup ? 0 : localX, needsPaintGroup ? 0 : localY, !needsPaintGroup),
          opacity: paintOpacity,
          ...state,
          timing: { start: 0, duration },
          payload: { shape: "polygon", points: borderBand(region, from, to) },
          style: { fill: color },
        } as Extract<MotionProtocolV2["layers"][number], { type: "shape" }>);
        if (config.style === "inset" || config.style === "outset") {
          const lightSide = config.style === "outset" ? topOrLeft : !topOrLeft;
          pushBand(0, 0, 1, lightSide ? light : dark);
        } else {
          // Fixed lighting contract: groove is recessed and ridge is
          // raised. Each side is split across its physical border
          // width, so shading never changes layout geometry.
          const outerDark = config.style === "groove" ? topOrLeft : !topOrLeft;
          pushBand(0, 0, 0.5, outerDark ? dark : light);
          pushBand(1, 0.5, 1, outerDark ? light : dark);
        }
        return;
      }
      // CSS does not paint unequal solid borders as four centered
      // strokes. Each edge owns a trapezoid and adjacent edges
      // meet on a diagonal at the corner. Using a butt-capped
      // stroke here shortens the edge and leaves the wrong join.
      // Lower solid edges to filled polygons so the protocol keeps
      // the CSS border-box geometry without needing a new atom.
      if (config.style === "solid") {
        const width = borderBox.width;
        const height = borderBox.height;
        const top = border.top.width;
        const right = border.right.width;
        const bottom = border.bottom.width;
        const left = border.left.width;
        const points = side === "top"
          ? [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width - right, y: top }, { x: left, y: top }]
          : side === "right"
            ? [{ x: width, y: 0 }, { x: width, y: height }, { x: width - right, y: height - bottom }, { x: width - right, y: top }]
            : side === "bottom"
              ? [{ x: 0, y: height }, { x: width, y: height }, { x: width - right, y: height - bottom }, { x: left, y: height - bottom }]
              : [{ x: 0, y: 0 }, { x: left, y: top }, { x: left, y: height - bottom }, { x: 0, y: height }];
        layers.push({
          id: `${borderId}:${side}`,
          type: "shape",
          parentLayerId: needsPaintGroup ? groupId : parentId,
          order: borderOrder + index * 10,
          frame: { width, height },
          transform: transformFor(needsPaintGroup ? 0 : localX, needsPaintGroup ? 0 : localY, !needsPaintGroup),
          opacity: paintOpacity,
          ...state,
          timing: { start: 0, duration },
          payload: { shape: "polygon", points },
          style: { fill: config.color },
        } as Extract<MotionProtocolV2["layers"][number], { type: "shape" }>);
        return;
      }
      if ((cornerRadius === undefined || cornerRadius === 0) && (config.style === "dashed" || config.style === "dotted")) {
        const horizontal = side === "top" || side === "bottom";
        const edgeLength = horizontal ? borderBox.width : borderBox.height;
        const runs = fitBorderDashRuns(edgeLength, config.width, config.style);
        const region = borderRegion(side, borderBox.width, borderBox.height, border.top.width, border.right.width, border.bottom.width, border.left.width);
        runs.forEach((run, runIndex) => {
          const isDotted = config.style === "dotted";
          if (!isDotted) {
            const base = horizontal
              ? [{ x: run.offset, y: side === "top" ? 0 : borderBox.height - config.width }, { x: run.offset + run.length, y: side === "top" ? 0 : borderBox.height - config.width }, { x: run.offset + run.length, y: side === "top" ? config.width : borderBox.height }, { x: run.offset, y: side === "top" ? config.width : borderBox.height }]
              : [{ x: side === "left" ? 0 : borderBox.width - config.width, y: run.offset }, { x: side === "left" ? config.width : borderBox.width, y: run.offset }, { x: side === "left" ? config.width : borderBox.width, y: run.offset + run.length }, { x: side === "left" ? 0 : borderBox.width - config.width, y: run.offset + run.length }];
            const points = clipConvexPolygon(base, region);
            if (points.length < 3) return;
            layers.push({ id: `${borderId}:${side}:${runIndex}`, type: "shape", parentLayerId: groupId, order: borderOrder + index * 10000 + runIndex, frame: { width: borderBox.width, height: borderBox.height }, transform: transformFor(0, 0, false), opacity: paintOpacity, ...state, timing: { start: 0, duration }, payload: { shape: "polygon", points }, style: { fill: config.color } } as Extract<MotionProtocolV2["layers"][number], { type: "shape" }>);
            return;
          }
          const center = horizontal
            ? { x: run.offset, y: side === "top" ? config.width / 2 : borderBox.height - config.width / 2 }
            : { x: side === "left" ? config.width / 2 : borderBox.width - config.width / 2, y: run.offset };
          const cornerRun = runIndex === 0 || runIndex === runs.length - 1;
          if (cornerRun) {
            const points = clipConvexPolygon(circlePolygon(center, config.width / 2), region);
            if (points.length < 3) return;
            layers.push({ id: `${borderId}:${side}:${runIndex}`, type: "shape", parentLayerId: groupId, order: borderOrder + index * 10000 + runIndex, frame: { width: borderBox.width, height: borderBox.height }, transform: transformFor(0, 0, false), opacity: paintOpacity, ...state, timing: { start: 0, duration }, payload: { shape: "polygon", points }, style: { fill: config.color } } as Extract<MotionProtocolV2["layers"][number], { type: "shape" }>);
            return;
          }
          const offsetX = horizontal ? center.x - config.width / 2 : side === "left" ? 0 : borderBox.width - config.width;
          const offsetY = horizontal ? (side === "top" ? 0 : borderBox.height - config.width) : center.y - config.width / 2;
          layers.push({ id: `${borderId}:${side}:${runIndex}`, type: "shape", parentLayerId: groupId, order: borderOrder + index * 10000 + runIndex, frame: { width: config.width, height: config.width }, transform: transformFor(offsetX, offsetY, false), opacity: paintOpacity, ...state, timing: { start: 0, duration }, payload: { shape: "ellipse" }, style: { fill: config.color } } as Extract<MotionProtocolV2["layers"][number], { type: "shape" }>);
        });
        return;
      }
      const horizontal = side === "top" || side === "bottom";
      const isDouble = config.style === "double";
      const half = config.width / 2;
      const start = horizontal
        ? { x: isDouble ? 0 : half, y: side === "top" ? half : borderBox.height - half }
        : { x: side === "left" ? (isDouble ? 0 : half) : borderBox.width - (isDouble ? 0 : half), y: isDouble ? 0 : half };
      const end = horizontal
        ? { x: isDouble ? borderBox.width : borderBox.width - half, y: start.y }
        : { x: start.x, y: isDouble ? borderBox.height : borderBox.height - half };
      // Chromium's CSS border painter uses a compact 2:1 dash/gap
      // rhythm for `dashed`. For `dotted`, a round-capped near-zero
      // dash produces one dot whose diameter is the border width;
      // using a full-width dash here makes every dot twice as long.
      const dash = config.style === "dashed"
        ? { array: [config.width * 2, config.width], offset: 0 }
        : config.style === "dotted"
          ? { array: [config.width * 0.01, config.width * 2 - config.width * 0.01], offset: 0 }
          : undefined;
      const count = config.style === "double" ? 2 : 1;
      for (let pass = 0; pass < count; pass += 1) {
        const center = isDouble
          ? (pass === 0 ? config.width / 6 : config.width * 5 / 6)
          : half;
        const movedStart = horizontal
          ? { x: isDouble && pass === 1 ? config.width : start.x, y: side === "top" ? center : borderBox.height - center }
          : { x: side === "left" ? center : borderBox.width - center, y: isDouble && pass === 1 ? config.width : start.y };
        const movedEnd = horizontal
          ? { x: isDouble && pass === 1 ? borderBox.width - config.width : end.x, y: movedStart.y }
          : { x: movedStart.x, y: isDouble && pass === 1 ? borderBox.height - config.width : end.y };
        layers.push({ id: `${borderId}:${side}:${pass}`, type: "path", parentLayerId: needsPaintGroup ? groupId : parentId, order: borderOrder + index * 10 + pass, frame: { width: borderBox.width, height: borderBox.height }, transform: transformFor(needsPaintGroup ? 0 : localX, needsPaintGroup ? 0 : localY, !needsPaintGroup), opacity: paintOpacity, ...state, timing: { start: 0, duration }, payload: { contours: [{ id: `${borderId}:${side}:${pass}-contour`, start: movedStart, segments: [{ kind: "line", to: movedEnd }], closed: false }] }, style: { fill: "none", stroke: config.color, strokeWidth: isDouble ? config.width / 3 : config.width, strokeCap: config.style === "dotted" ? "round" : "butt", ...(dash ? { strokeDash: dash } : {}) } } as Extract<MotionProtocolV2["layers"][number], { type: "path" }>);
      }
    };
    (["top", "right", "bottom", "left"] as const).forEach((side, index) => emitBorderSide(side, index));
  }
}
