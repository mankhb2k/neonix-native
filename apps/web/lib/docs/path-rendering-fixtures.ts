import type { MotionProtocolV2, V2Filter, V2TextLayer, V2TextSpan } from "@motionvideo/motion-protocol/v2";

const transform = {
  translate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
  rotate: { x: 0, y: 0, z: 0 }, skew: { x: 0, y: 0 }, anchor: { x: 0, y: 0, z: 0 },
};

const scaledTransform = {
  ...transform,
  translate: { x: 320, y: 120, z: 0 },
  scale: { x: 1.6, y: 1.6, z: 1 },
};

type SvgPath = { d: string; fill?: string; fillOpacity?: number; stroke?: string; strokeWidth?: number; strokeOpacity?: number; join?: "miter" | "bevel" | "round"; cap?: "butt" | "square" | "round"; dash?: string; dashOffset?: number; transform?: string; vectorEffect?: "none" | "non-scaling-stroke" };
type SvgFilterReference = { id: string; kind: "blur" | "drop-shadow" | "outer-glow" | "inner-glow" | "saturate" | "hue-rotate"; stdDeviation?: number };
type SvgTextSpan = { text: string; fill?: string };
type SvgTextReference = {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight?: number;
  fontStyle?: "normal" | "italic" | "oblique";
  fontStretch?: string;
  textAnchor?: "start" | "middle" | "end";
  letterSpacing?: number;
  wordSpacing?: number;
  direction?: "ltr" | "rtl";
  writingMode?: "horizontal-tb" | "vertical-rl" | "vertical-lr";
  whiteSpace?: "normal" | "pre";
  textRendering?: "auto" | "optimizeSpeed" | "geometricPrecision";
  dx?: number[];
  dy?: number[];
  rotate?: number[];
  dominantBaseline?: "auto" | "use-script" | "no-change" | "reset-size" | "ideographic" | "alphabetic" | "hanging" | "mathematical" | "central" | "middle" | "text-after-edge" | "text-before-edge";
  alignmentBaseline?: "auto" | "baseline" | "before-edge" | "text-before-edge" | "middle" | "central" | "after-edge" | "text-after-edge" | "ideographic" | "alphabetic" | "hanging" | "mathematical";
  baselineShift?: string;
  textLength?: number;
  lengthAdjust?: "spacing" | "spacingAndGlyphs";
  textDecoration?: string;
  stroke?: string;
  strokeWidth?: number;
  textPathD?: string;
  textPathStartOffset?: number;
  spans?: SvgTextSpan[];
};
export type PathRenderingFixture = { id: string; label: string; project: MotionProtocolV2; svg: SvgPath[]; svgText?: SvgTextReference; svgFilter?: SvgFilterReference; probes: Array<{ name: string; x: number; y: number; expected: "paint" | "background" }> };
type PathPoint = { x: number; y: number };
type PathSegment =
  | { kind: "line"; to: PathPoint }
  | { kind: "quadratic"; control: PathPoint; to: PathPoint }
  | { kind: "cubic"; control1: PathPoint; control2: PathPoint; to: PathPoint }
  | { kind: "arc"; radii: { x: number; y: number }; rotation: number; largeArc: boolean; sweep: boolean; to: PathPoint };

const TEXT_PREVIEW_FONT = {
  id: "debug-noto-sans-regular",
  kind: "font" as const,
  uri: "/preview/font/Noto_Sans/NotoSans-Regular.ttf",
  mimeType: "font/ttf" as const,
  family: "Noto Sans",
  weight: 400,
  style: "normal" as const,
  integrity: "sha256:fe8c022f48d8dd29f17b744d16f9346f4357e16f7d4f7be58b000ae7c291b614",
};

const TEXT_PREVIEW_BOLD_ITALIC_FONT = {
  id: "debug-noto-sans-bold-italic",
  kind: "font" as const,
  uri: "/preview/font/Noto_Sans/NotoSans-BoldItalic.ttf",
  mimeType: "font/ttf" as const,
  family: "Noto Sans",
  weight: 700,
  style: "italic" as const,
  integrity: "sha256:7e34616e092593c340449baf9a259075a054c6419511ccf21ff0d83a1c9dd0d0",
};

function project(id: string, layers: MotionProtocolV2["layers"], filters: V2Filter[] = [], assets: MotionProtocolV2["assets"] = []): MotionProtocolV2 {
  const projectAssets = assets.some((asset) => asset.id === TEXT_PREVIEW_FONT.id)
    ? [...assets, ...(assets.some((asset) => asset.id === TEXT_PREVIEW_BOLD_ITALIC_FONT.id) ? [] : [TEXT_PREVIEW_BOLD_ITALIC_FONT])]
    : assets;
  return {
    format: "motion-protocol", formatVersion: 2, id,
    composition: { width: 960, height: 540, fps: 30, background: "#101820", colorSpace: "srgb", view: { projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 }, transform: { translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 } } } },
    assets: projectAssets, ...(filters.length ? { filters } : {}), audio: { sampleRate: 48000, tracks: [] }, layers,
  };
}

function textLayer(id: string, value: string, options: {
  x?: number;
  y?: number;
  fontSize?: number;
  textAnchor?: "start" | "middle" | "end";
  letterSpacing?: number;
  wordSpacing?: number;
  direction?: "ltr" | "rtl";
  spans?: Array<{ start: number; end: number; id: string; fill: string }>;
  writingMode?: "horizontal-tb" | "vertical-rl" | "vertical-lr";
  dx?: number[];
  dy?: number[];
  rotate?: number[];
  textPath?: { pathId: string; startOffset?: number };
  whiteSpace?: "default" | "preserve";
  textRendering?: "auto" | "optimizeSpeed" | "geometricPrecision";
  spanStyle?: Partial<Omit<V2TextSpan, "id" | "sourceRange" | "font">> & { font?: Partial<V2TextSpan["font"]> };
} = {}): V2TextLayer {
  const text = value.normalize("NFC");
  const fontSize = options.fontSize ?? 72;
  const fontOverrides = options.spanStyle?.font;
  const spanStyle = { ...options.spanStyle };
  delete spanStyle.font;
  const cleanSpanStyle = spanStyle as Omit<typeof spanStyle, "font">;
  const spans = options.spans ?? [{ start: 0, end: text.length, id: `${id}-span`, fill: "#f8fafc" }];
  return {
    id,
    type: "text",
    parentLayerId: null,
    order: 0,
    frame: { width: 960, height: 540 },
    transform: { ...transform, translate: { x: options.x ?? 0, y: options.y ?? 140, z: 0 } },
    opacity: 1,
    timing: { start: 0, duration: 3000 },
    payload: {
      chunks: [{
        id: `${id}-chunk`,
        sourceRange: { start: 0, end: text.length },
        ...(options.dx ? { dx: options.dx.map((value) => ({ value, unit: "px" as const })) } : {}),
        ...(options.dy ? { dy: options.dy.map((value) => ({ value, unit: "px" as const })) } : {}),
        ...(options.rotate ? { rotate: options.rotate } : {}),
        textAnchor: options.textAnchor,
        ...(options.textPath ? { textPath: { pathId: options.textPath.pathId, ...(options.textPath.startOffset !== undefined ? { startOffset: { value: options.textPath.startOffset, unit: "px" as const } } : {}) } } : {}),
        spans: spans.map((span) => ({
          id: span.id,
          sourceRange: { start: span.start, end: span.end },
          font: { ...fontOverrides, families: fontOverrides?.families ?? ["Noto Sans", "sans-serif"], size: fontOverrides?.size ?? fontSize },
          fill: span.fill,
          ...(options.letterSpacing !== undefined ? { letterSpacing: { value: options.letterSpacing, unit: "px" as const } } : {}),
          ...(options.wordSpacing !== undefined ? { wordSpacing: { value: options.wordSpacing, unit: "px" as const } } : {}),
          ...cleanSpanStyle,
        })),
      }],
      source: {
        text,
        language: options.direction === "rtl" ? "ar" : "en",
        direction: options.direction,
        writingMode: options.writingMode,
        whiteSpace: options.whiteSpace,
        textRendering: options.textRendering,
      },
    },
  };
}

function pathLayer(id: string, d: { start: PathPoint; segments: PathSegment[]; closed: boolean }, style: Record<string, unknown>, filter?: string): MotionProtocolV2["layers"][number] {
  // Stroke-only SVG references in this lab explicitly use fill="none". Keep
  // the protocol fixture equally explicit instead of inheriting SVG's default
  // black fill and mistaking it for a stroke-outline artifact.
  return { id, type: "path", parentLayerId: null, order: 0, frame: { width: 960, height: 540 }, transform, opacity: 1, timing: { start: 0, duration: 3000 }, ...(filter ? { filter } : {}), payload: { contours: [{ id: `${id}-contour`, ...d }], fillRule: "nonzero" }, style: { fill: "none", ...style } };
}

function filterDefinition(id: string, kind: SvgFilterReference["kind"], stdDeviation = 12): V2Filter {
  const base = { id, filterUnits: "objectBoundingBox" as const, primitiveUnits: "userSpaceOnUse" as const, colorInterpolationFilters: "linearRGB" as const };
  if (kind === "blur") return { ...base, primitives: [{ id: "blur", type: "feGaussianBlur", in: "SourceGraphic", stdDeviation: { x: stdDeviation, y: stdDeviation }, result: "blurred" }] };
  if (kind === "drop-shadow") return { ...base, primitives: [{ id: "shadow", type: "feDropShadow", in: "SourceGraphic", dx: 18, dy: 20, stdDeviation: { x: 12, y: 12 }, floodColor: "#ff3366", floodOpacity: 0.8 }] };
  if (kind === "saturate") return { ...base, primitives: [{ id: "saturate", type: "feColorMatrix", in: "SourceGraphic", kind: "saturate", values: [0.25] }] };
  if (kind === "hue-rotate") return { ...base, primitives: [{ id: "hue", type: "feColorMatrix", in: "SourceGraphic", kind: "hueRotate", values: [120] }] };
  if (kind === "outer-glow") return { ...base, primitives: [
    { id: "blur", type: "feGaussianBlur", in: "SourceAlpha", stdDeviation: { x: 12, y: 12 }, result: "blurred" },
    { id: "flood", type: "feFlood", color: "#00e5ff", opacity: 0.75, result: "color" },
    { id: "composite", type: "feComposite", in: "color", in2: "blurred", operator: "in", result: "glow" },
    { id: "merge", type: "feMerge", nodes: [{ in: "glow" }, { in: "SourceGraphic" }] },
  ] };
  return { ...base, primitives: [
    { id: "blur", type: "feGaussianBlur", in: "SourceAlpha", stdDeviation: { x: 12, y: 12 }, result: "blurred" },
    { id: "edge", type: "feComposite", in: "SourceAlpha", in2: "blurred", operator: "out", result: "edge" },
    { id: "flood", type: "feFlood", color: "#ff3366", opacity: 0.8, result: "color" },
    { id: "composite", type: "feComposite", in: "color", in2: "edge", operator: "in", result: "glow" },
    { id: "merge", type: "feMerge", nodes: [{ in: "glow" }, { in: "SourceGraphic" }] },
  ] };
}

function filteredPathProject(
  id: string,
  filter: V2Filter,
  d: { start: PathPoint; segments: PathSegment[]; closed: boolean },
  style: Record<string, unknown>,
): MotionProtocolV2 {
  return project(id, [pathLayer(id, d, style, filter.id)], [filter]);
}

function filteredRectangleProject(
  id: string,
  filter: V2Filter,
): MotionProtocolV2 {
  return project(id, [{
    id,
    type: "shape",
    parentLayerId: null,
    order: 0,
    frame: { width: 360, height: 220 },
    transform: { ...transform, translate: { x: 300, y: 160, z: 0 } },
    opacity: 1,
    timing: { start: 0, duration: 3000 },
    filter: filter.id,
    payload: { shape: "rectangle" },
    style: { fill: "#00aa88", stroke: "#38bdf8", strokeWidth: 12 },
  }], [filter]);
}

const v = { start: { x: 250, y: 300 }, segments: [{ kind: "line" as const, to: { x: 480, y: 130 } }, { kind: "line" as const, to: { x: 710, y: 300 } }], closed: false };
const pentagon = { start: { x: 300, y: 140 }, segments: [{ kind: "line" as const, to: { x: 510, y: 100 } }, { kind: "line" as const, to: { x: 700, y: 190 } }, { kind: "line" as const, to: { x: 640, y: 390 } }, { kind: "line" as const, to: { x: 370, y: 410 } }, { kind: "line" as const, to: { x: 300, y: 140 } }], closed: true };
const zigzag = { start: { x: 180, y: 320 }, segments: [{ kind: "line" as const, to: { x: 300, y: 150 } }, { kind: "line" as const, to: { x: 420, y: 320 } }, { kind: "line" as const, to: { x: 540, y: 150 } }, { kind: "line" as const, to: { x: 660, y: 320 } }], closed: false };
const scaledVectorEffectPath = { start: { x: 80, y: 80 }, segments: [{ kind: "line" as const, to: { x: 200, y: 220 } }, { kind: "line" as const, to: { x: 320, y: 80 } }], closed: false };

export const PATH_RENDERING_FIXTURES: PathRenderingFixture[] = [
  { id: "open-line", label: "Open line / butt cap", project: project("debug-open-line", [pathLayer("line", { start: { x: 220, y: 270 }, segments: [{ kind: "line", to: { x: 740, y: 270 } }], closed: false }, { stroke: "#ff3366", strokeWidth: 8, strokeCap: "butt" })]), svg: [{ d: "M 220 270 L 740 270", stroke: "#ff3366", strokeWidth: 8, cap: "butt" }], probes: [{ name: "center", x: 480, y: 270, expected: "paint" }, { name: "outside", x: 480, y: 250, expected: "background" }] },
  { id: "vector-effect-none", label: "Vector effect / none", project: project("debug-vector-effect-none", [{ ...pathLayer("vector-effect-none", scaledVectorEffectPath, { stroke: "#f97316", strokeWidth: 18, strokeCap: "butt", strokeJoin: "round" }), transform: scaledTransform }]), svg: [{ d: "M 80 80 L 200 220 L 320 80", stroke: "#f97316", strokeWidth: 18, cap: "butt", join: "round", transform: "translate(320 120) scale(1.6)" }], probes: [{ name: "scaled-stroke", x: 480, y: 280, expected: "paint" }, { name: "outside", x: 480, y: 245, expected: "background" }] },
  { id: "vector-effect-non-scaling-stroke", label: "Vector effect / non-scaling-stroke", project: project("debug-vector-effect-non-scaling-stroke", [{ ...pathLayer("vector-effect-non-scaling-stroke", scaledVectorEffectPath, { stroke: "#f97316", strokeWidth: 18, strokeCap: "butt", strokeJoin: "round", vectorEffect: "non-scaling-stroke" }), transform: scaledTransform }]), svg: [{ d: "M 80 80 L 200 220 L 320 80", stroke: "#f97316", strokeWidth: 18, cap: "butt", join: "round", transform: "translate(320 120) scale(1.6)", vectorEffect: "non-scaling-stroke" }], probes: [{ name: "fixed-stroke", x: 480, y: 280, expected: "paint" }, { name: "outside", x: 480, y: 245, expected: "background" }] },
  { id: "cubic-round", label: "Cubic / round cap", project: project("debug-cubic-round", [pathLayer("cubic", { start: { x: 190, y: 330 }, segments: [{ kind: "cubic", control1: { x: 340, y: 60 }, control2: { x: 620, y: 60 }, to: { x: 770, y: 330 } }], closed: false }, { stroke: "#ff3366", strokeWidth: 24, strokeCap: "round", strokeJoin: "round" })]), svg: [{ d: "M 190 330 C 340 60 620 60 770 330", stroke: "#ff3366", strokeWidth: 24, cap: "round", join: "round" }], probes: [{ name: "start-cap", x: 180, y: 330, expected: "paint" }, { name: "outside", x: 120, y: 330, expected: "background" }] },
  { id: "quadratic-round", label: "Quadratic / round cap", project: project("debug-quadratic-round", [pathLayer("quadratic", { start: { x: 190, y: 330 }, segments: [{ kind: "quadratic", control: { x: 480, y: 10 }, to: { x: 770, y: 330 } }], closed: false }, { stroke: "#38bdf8", strokeWidth: 24, strokeCap: "round" })]), svg: [{ d: "M 190 330 Q 480 10 770 330", stroke: "#38bdf8", strokeWidth: 24, cap: "round" }], probes: [{ name: "start-cap", x: 180, y: 330, expected: "paint" }, { name: "outside", x: 480, y: 30, expected: "background" }] },
  { id: "arc-round", label: "Elliptical arc / round cap", project: project("debug-arc-round", [pathLayer("arc", { start: { x: 190, y: 270 }, segments: [{ kind: "arc", radii: { x: 290, y: 190 }, rotation: 0, largeArc: false, sweep: true, to: { x: 770, y: 270 } }], closed: false }, { stroke: "#a78bfa", strokeWidth: 24, strokeCap: "round" })]), svg: [{ d: "M 190 270 A 290 190 0 0 1 770 270", stroke: "#a78bfa", strokeWidth: 24, cap: "round" }], probes: [{ name: "arc", x: 480, y: 80, expected: "paint" }, { name: "outside", x: 480, y: 30, expected: "background" }] },
  { id: "arc-closed", label: "Elliptical arc / closed fill and stroke", project: project("debug-arc-closed", [pathLayer("arc-closed", { start: { x: 730, y: 270 }, segments: [{ kind: "arc", radii: { x: 250, y: 150 }, rotation: 0, largeArc: false, sweep: true, to: { x: 230, y: 270 } }, { kind: "arc", radii: { x: 250, y: 150 }, rotation: 0, largeArc: false, sweep: true, to: { x: 730, y: 270 } }], closed: true }, { fill: "#00aa88", stroke: "#ff3366", strokeWidth: 16, strokeJoin: "round" })]), svg: [{ d: "M 730 270 A 250 150 0 0 1 230 270 A 250 150 0 0 1 730 270 Z", fill: "#00aa88", stroke: "#ff3366", strokeWidth: 16, join: "round" }], probes: [{ name: "fill", x: 480, y: 270, expected: "paint" }, { name: "outside", x: 480, y: 90, expected: "background" }] },
  { id: "round-right-angle", label: "Round / 90 degree corner", project: project("debug-round-right-angle", [pathLayer("round-right-angle", { start: { x: 280, y: 360 }, segments: [{ kind: "line", to: { x: 280, y: 180 } }, { kind: "line", to: { x: 460, y: 180 } }], closed: false }, { stroke: "#38bdf8", strokeWidth: 32, strokeJoin: "round", strokeCap: "butt" })]), svg: [{ d: "M 280 360 L 280 180 L 460 180", stroke: "#38bdf8", strokeWidth: 32, join: "round", cap: "butt" }], probes: [{ name: "corner", x: 269, y: 169, expected: "paint" }, { name: "outside", x: 240, y: 140, expected: "background" }] },
  { id: "round-acute", label: "Round / acute corner", project: project("debug-round-acute", [pathLayer("round-acute", { start: { x: 220, y: 340 }, segments: [{ kind: "line", to: { x: 480, y: 120 } }, { kind: "line", to: { x: 740, y: 340 } }], closed: false }, { stroke: "#a78bfa", strokeWidth: 36, strokeJoin: "round", strokeCap: "butt" })]), svg: [{ d: "M 220 340 L 480 120 L 740 340", stroke: "#a78bfa", strokeWidth: 36, join: "round", cap: "butt" }], probes: [{ name: "corner", x: 480, y: 104, expected: "paint" }, { name: "outside", x: 480, y: 70, expected: "background" }] },
  { id: "round-zigzag", label: "Round / multiple joins", project: project("debug-round-zigzag", [pathLayer("round-zigzag", zigzag, { stroke: "#22c55e", strokeWidth: 24, strokeJoin: "round", strokeCap: "round" })]), svg: [{ d: "M 180 320 L 300 150 L 420 320 L 540 150 L 660 320", stroke: "#22c55e", strokeWidth: 24, join: "round", cap: "round" }], probes: [{ name: "first-join", x: 300, y: 138, expected: "paint" }, { name: "outside", x: 480, y: 100, expected: "background" }] },
  { id: "round-closed", label: "Round / closed contour", project: project("debug-round-closed", [pathLayer("round-closed", pentagon, { fill: "#164e63", stroke: "#f43f5e", strokeWidth: 24, strokeJoin: "round", strokeCap: "round" })]), svg: [{ d: "M 300 140 L 510 100 L 700 190 L 640 390 L 370 410 Z", fill: "#164e63", stroke: "#f43f5e", strokeWidth: 24, join: "round", cap: "round" }], probes: [{ name: "fill", x: 500, y: 240, expected: "paint" }, { name: "outside", x: 100, y: 100, expected: "background" }] },
  ...(["miter", "bevel", "round"] as const).map((join): PathRenderingFixture => ({ id: `join-${join}`, label: `Join / ${join}`, project: project(`debug-join-${join}`, [pathLayer(`join-${join}`, v, { stroke: "#f97316", strokeWidth: 28, strokeJoin: join, strokeCap: "butt" })]), svg: [{ d: "M 250 300 L 480 130 L 710 300", stroke: "#f97316", strokeWidth: 28, join, cap: "butt" }], probes: [{ name: "vertex", x: 480, y: 130, expected: "paint" }, { name: "far-outside", x: 480, y: 80, expected: "background" }] })),
  { id: "closed-solid", label: "Closed contour / no seam", project: project("debug-closed-solid", [pathLayer("closed", pentagon, { fill: "#00aa88", stroke: "#ff3366", strokeWidth: 18, strokeJoin: "round" })]), svg: [{ d: "M 300 140 L 510 100 L 700 190 L 640 390 L 370 410 Z", fill: "#00aa88", stroke: "#ff3366", strokeWidth: 18, join: "round" }], probes: [{ name: "fill", x: 500, y: 240, expected: "paint" }, { name: "outside", x: 100, y: 100, expected: "background" }] },
  { id: "mesh-transparent-join", label: "Mesh / transparent round join", project: project("debug-mesh-transparent-join", [pathLayer("mesh-transparent-join", v, { stroke: "#ff3366", strokeWidth: 36, strokeOpacity: 0.35, strokeJoin: "round", strokeCap: "butt" })]), svg: [{ d: "M 250 300 L 480 130 L 710 300", fill: "none", stroke: "#ff3366", strokeWidth: 36, strokeOpacity: 0.35, join: "round", cap: "butt" }], probes: [{ name: "vertex", x: 480, y: 130, expected: "paint" }, { name: "outside", x: 480, y: 70, expected: "background" }] },
  { id: "mesh-open-fill", label: "Mesh / open path fill closes implicitly", project: project("debug-mesh-open-fill", [pathLayer("mesh-open-fill", { start: { x: 250, y: 150 }, segments: [{ kind: "line", to: { x: 710, y: 150 } }, { kind: "line", to: { x: 480, y: 400 } }], closed: false }, { fill: "#00aa88", stroke: "#38bdf8", strokeWidth: 8, strokeCap: "butt" })]), svg: [{ d: "M 250 150 L 710 150 L 480 400", fill: "#00aa88", stroke: "#38bdf8", strokeWidth: 8, cap: "butt" }], probes: [{ name: "fill", x: 480, y: 250, expected: "paint" }, { name: "outside", x: 480, y: 430, expected: "background" }] },
  { id: "mesh-concave-round", label: "Mesh / concave closed round ring", project: project("debug-mesh-concave-round", [pathLayer("mesh-concave-round", { start: { x: 240, y: 160 }, segments: [{ kind: "line", to: { x: 700, y: 160 } }, { kind: "line", to: { x: 580, y: 270 } }, { kind: "line", to: { x: 700, y: 390 } }, { kind: "line", to: { x: 240, y: 390 } }, { kind: "line", to: { x: 360, y: 270 } }, { kind: "line", to: { x: 240, y: 160 } }], closed: true }, { fill: "#164e63", stroke: "#f97316", strokeWidth: 20, strokeJoin: "round" })]), svg: [{ d: "M 240 160 H 700 L 580 270 L 700 390 H 240 L 360 270 Z", fill: "#164e63", stroke: "#f97316", strokeWidth: 20, join: "round" }], probes: [{ name: "fill", x: 420, y: 270, expected: "paint" }, { name: "notch", x: 600, y: 270, expected: "background" }] },
  { id: "mesh-curved-round", label: "Mesh / high-curvature round stroke", project: project("debug-mesh-curved-round", [pathLayer("mesh-curved-round", { start: { x: 150, y: 320 }, segments: [{ kind: "cubic", control1: { x: 180, y: 30 }, control2: { x: 390, y: 30 }, to: { x: 480, y: 270 } }, { kind: "cubic", control1: { x: 570, y: 510 }, control2: { x: 780, y: 510 }, to: { x: 810, y: 220 } }], closed: false }, { stroke: "#38bdf8", strokeWidth: 28, strokeJoin: "round", strokeCap: "round" })]), svg: [{ d: "M 150 320 C 180 30 390 30 480 270 C 570 510 780 510 810 220", fill: "none", stroke: "#38bdf8", strokeWidth: 28, join: "round", cap: "round" }], probes: [{ name: "curve", x: 480, y: 270, expected: "paint" }, { name: "outside", x: 480, y: 90, expected: "background" }] },
  { id: "closed-dash", label: "Closed contour / dash seam", project: project("debug-closed-dash", [pathLayer("closed-dash", pentagon, { fill: "#00aa88", stroke: "#ff3366", strokeWidth: 18, strokeJoin: "round", strokeCap: "butt", strokeDash: { array: [72, 28], offset: 0 } })]), svg: [{ d: "M 300 140 L 510 100 L 700 190 L 640 390 L 370 410 Z", fill: "#00aa88", stroke: "#ff3366", strokeWidth: 18, join: "round", cap: "butt", dash: "72 28" }], probes: [{ name: "fill", x: 500, y: 240, expected: "paint" }, { name: "outside", x: 100, y: 100, expected: "background" }] },
  { id: "dash-offset", label: "Open line / dash offset", project: project("debug-dash-offset", [pathLayer("dash-offset", { start: { x: 180, y: 270 }, segments: [{ kind: "line", to: { x: 780, y: 270 } }], closed: false }, { stroke: "#ff3366", strokeWidth: 20, strokeCap: "round", strokeDash: { array: [60, 30], offset: -24 } })]), svg: [{ d: "M 180 270 L 780 270", stroke: "#ff3366", strokeWidth: 20, cap: "round", dash: "60 30", dashOffset: -24 }], probes: [{ name: "outside", x: 100, y: 270, expected: "background" }] },
  { id: "shape-dash", label: "Shape / dashed stroke", project: project("debug-shape-dash", [{ id: "shape-dash", type: "shape", parentLayerId: null, order: 0, frame: { width: 360, height: 220 }, transform: { ...transform, translate: { x: 300, y: 160, z: 0 } }, opacity: 1, timing: { start: 0, duration: 3000 }, payload: { shape: "rectangle" }, style: { fill: "#00aa88", stroke: "#ff3366", strokeWidth: 18, strokeDash: { array: [36, 18], offset: 6 } } }]), svg: [{ d: "M 300 160 H 660 V 380 H 300 Z", fill: "#00aa88", stroke: "#ff3366", strokeWidth: 18, dash: "36 18", dashOffset: 6 }], probes: [{ name: "fill", x: 480, y: 270, expected: "paint" }, { name: "outside", x: 200, y: 120, expected: "background" }] },
  { id: "filter-fe-gaussian-blur", label: "Filter / feGaussianBlur", project: filteredPathProject("debug-filter-fe-gaussian-blur", filterDefinition("filter-gaussian-blur", "blur"), pentagon, { fill: "#00aa88", stroke: "#38bdf8", strokeWidth: 12 }), svgFilter: { id: "filter-gaussian-blur", kind: "blur" }, svg: [{ d: "M 300 140 L 510 100 L 700 190 L 640 390 L 370 410 Z", fill: "#00aa88", stroke: "#38bdf8", strokeWidth: 12 }], probes: [{ name: "center", x: 500, y: 240, expected: "paint" }, { name: "far-outside", x: 100, y: 100, expected: "background" }] },
  { id: "filter-fe-gaussian-blur-4", label: "Filter / rect blur 4px", project: filteredRectangleProject("debug-filter-fe-gaussian-blur-4", filterDefinition("filter-gaussian-blur-4", "blur", 4)), svgFilter: { id: "filter-gaussian-blur-4", kind: "blur", stdDeviation: 4 }, svg: [{ d: "M 300 160 H 660 V 380 H 300 Z", fill: "#00aa88", stroke: "#38bdf8", strokeWidth: 12 }], probes: [{ name: "center", x: 480, y: 270, expected: "paint" }] },
  { id: "filter-fe-gaussian-blur-40", label: "Filter / rect blur 40px", project: filteredRectangleProject("debug-filter-fe-gaussian-blur-40", filterDefinition("filter-gaussian-blur-40", "blur", 40)), svgFilter: { id: "filter-gaussian-blur-40", kind: "blur", stdDeviation: 40 }, svg: [{ d: "M 300 160 H 660 V 380 H 300 Z", fill: "#00aa88", stroke: "#38bdf8", strokeWidth: 12 }], probes: [{ name: "center", x: 480, y: 270, expected: "paint" }] },
  { id: "filter-fe-gaussian-blur-256", label: "Filter / rect blur 256px", project: filteredRectangleProject("debug-filter-fe-gaussian-blur-256", filterDefinition("filter-gaussian-blur-256", "blur", 256)), svgFilter: { id: "filter-gaussian-blur-256", kind: "blur", stdDeviation: 256 }, svg: [{ d: "M 300 160 H 660 V 380 H 300 Z", fill: "#00aa88", stroke: "#38bdf8", strokeWidth: 12 }], probes: [{ name: "center", x: 480, y: 270, expected: "paint" }] },
  { id: "filter-fe-drop-shadow", label: "Filter / feDropShadow", project: filteredPathProject("debug-filter-fe-drop-shadow", filterDefinition("filter-drop-shadow", "drop-shadow"), pentagon, { fill: "#00aa88", stroke: "#38bdf8", strokeWidth: 12 }), svgFilter: { id: "filter-drop-shadow", kind: "drop-shadow" }, svg: [{ d: "M 300 140 L 510 100 L 700 190 L 640 390 L 370 410 Z", fill: "#00aa88", stroke: "#38bdf8", strokeWidth: 12 }], probes: [{ name: "shadow-side", x: 710, y: 390, expected: "paint" }, { name: "far-outside", x: 100, y: 100, expected: "background" }] },
  { id: "filter-fe-outer-glow", label: "Filter graph / outer glow", project: filteredPathProject("debug-filter-fe-outer-glow", filterDefinition("filter-outer-glow", "outer-glow"), pentagon, { fill: "#164e63", stroke: "#f8fafc", strokeWidth: 10 }), svgFilter: { id: "filter-outer-glow", kind: "outer-glow" }, svg: [{ d: "M 300 140 L 510 100 L 700 190 L 640 390 L 370 410 Z", fill: "#164e63", stroke: "#f8fafc", strokeWidth: 10 }], probes: [{ name: "glow-side", x: 710, y: 190, expected: "paint" }, { name: "far-outside", x: 100, y: 100, expected: "background" }] },
  { id: "filter-fe-inner-glow", label: "Filter graph / inner glow", project: filteredPathProject("debug-filter-fe-inner-glow", filterDefinition("filter-inner-glow", "inner-glow"), pentagon, { fill: "#164e63", stroke: "#f8fafc", strokeWidth: 10 }), svgFilter: { id: "filter-inner-glow", kind: "inner-glow" }, svg: [{ d: "M 300 140 L 510 100 L 700 190 L 640 390 L 370 410 Z", fill: "#164e63", stroke: "#f8fafc", strokeWidth: 10 }], probes: [{ name: "center", x: 500, y: 240, expected: "paint" }, { name: "far-outside", x: 100, y: 100, expected: "background" }] },
  { id: "filter-fe-color-matrix-saturate", label: "Filter / feColorMatrix saturate", project: filteredPathProject("debug-filter-fe-color-matrix-saturate", filterDefinition("filter-saturate", "saturate"), pentagon, { fill: "#f97316", stroke: "#38bdf8", strokeWidth: 12 }), svgFilter: { id: "filter-saturate", kind: "saturate" }, svg: [{ d: "M 300 140 L 510 100 L 700 190 L 640 390 L 370 410 Z", fill: "#f97316", stroke: "#38bdf8", strokeWidth: 12 }], probes: [{ name: "center", x: 500, y: 240, expected: "paint" }, { name: "outside", x: 100, y: 100, expected: "background" }] },
  { id: "filter-fe-color-matrix-hue", label: "Filter / feColorMatrix hueRotate", project: filteredPathProject("debug-filter-fe-color-matrix-hue", filterDefinition("filter-hue-rotate", "hue-rotate"), pentagon, { fill: "#f97316", stroke: "#38bdf8", strokeWidth: 12 }), svgFilter: { id: "filter-hue-rotate", kind: "hue-rotate" }, svg: [{ d: "M 300 140 L 510 100 L 700 190 L 640 390 L 370 410 Z", fill: "#f97316", stroke: "#38bdf8", strokeWidth: 12 }], probes: [{ name: "center", x: 500, y: 240, expected: "paint" }, { name: "outside", x: 100, y: 100, expected: "background" }] },
  { id: "text-plain", label: "Text / plain glyph shaping", project: project("debug-text-plain", [textLayer("text-plain", "SVG text: Hello Việt Nam", { x: 80, y: 120, fontSize: 64 })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "SVG text: Hello Việt Nam", x: 80, y: 190, fontSize: 64 }, svg: [], probes: [{ name: "center", x: 480, y: 190, expected: "paint" }, { name: "outside", x: 80, y: 280, expected: "background" }] },
  { id: "text-mask-12", label: "Text / A8 mask 12px", project: project("debug-text-mask-12", [textLayer("text-mask-12", "small mask", { x: 180, y: 170, fontSize: 12 })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "small mask", x: 180, y: 182, fontSize: 12, textRendering: "optimizeSpeed" }, svg: [], probes: [{ name: "text", x: 230, y: 178, expected: "paint" }, { name: "outside", x: 180, y: 220, expected: "background" }] },
  { id: "text-mask-24", label: "Text / A8 mask 24px", project: project("debug-text-mask-24", [textLayer("text-mask-24", "display mask", { x: 180, y: 170, fontSize: 24 })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "display mask", x: 180, y: 194, fontSize: 24, textRendering: "geometricPrecision" }, svg: [], probes: [{ name: "text", x: 260, y: 187, expected: "paint" }, { name: "outside", x: 180, y: 240, expected: "background" }] },
  { id: "text-mask-48", label: "Text / A8 mask 48px", project: project("debug-text-mask-48", [textLayer("text-mask-48", "largest mask", { x: 160, y: 170, fontSize: 48 })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "largest mask", x: 160, y: 218, fontSize: 48, textRendering: "geometricPrecision" }, svg: [], probes: [{ name: "text", x: 250, y: 205, expected: "paint" }, { name: "outside", x: 160, y: 280, expected: "background" }] },
  { id: "text-vector-large", label: "Text / vector glyph mesh 72px", project: project("debug-text-vector-large", [textLayer("text-vector-large", "large vector glyphs", { x: 100, y: 130, fontSize: 72 })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "large vector glyphs", x: 100, y: 202, fontSize: 72, textRendering: "geometricPrecision" }, svg: [], probes: [{ name: "text", x: 300, y: 195, expected: "paint" }, { name: "outside", x: 100, y: 320, expected: "background" }] },
  { id: "text-vector-rotate", label: "Text / vector glyph strong rotation", project: project("debug-text-vector-rotate", [textLayer("text-vector-rotate", "rotated glyphs", { x: 260, y: 150, fontSize: 64, rotate: [18] })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "rotated glyphs", x: 260, y: 214, fontSize: 64, rotate: [18], textRendering: "geometricPrecision" }, svg: [], probes: [{ name: "text", x: 420, y: 200, expected: "paint" }, { name: "outside", x: 260, y: 330, expected: "background" }] },
  { id: "text-anchor-middle", label: "Text / text-anchor middle", project: project("debug-text-anchor-middle", [textLayer("text-anchor-middle", "middle anchored", { y: 120, fontSize: 72, textAnchor: "middle" })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "middle anchored", x: 480, y: 200, fontSize: 72, textAnchor: "middle" }, svg: [], probes: [{ name: "center", x: 480, y: 200, expected: "paint" }, { name: "outside", x: 480, y: 300, expected: "background" }] },
  { id: "text-multiline", label: "Text / multiline source", project: project("debug-text-multiline", [textLayer("text-multiline", "line one\nline two\nline three", { x: 100, y: 90, fontSize: 56 })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "line one", x: 100, y: 160, fontSize: 56 }, svg: [], probes: [{ name: "first-line", x: 180, y: 160, expected: "paint" }, { name: "second-line", x: 180, y: 227, expected: "paint" }, { name: "outside", x: 180, y: 330, expected: "background" }] },
  { id: "text-spacing", label: "Text / letter-spacing", project: project("debug-text-spacing", [textLayer("text-spacing", "letter spacing", { x: 100, y: 120, fontSize: 64, letterSpacing: 8 })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "letter spacing", x: 100, y: 190, fontSize: 64, letterSpacing: 8 }, svg: [], probes: [{ name: "text", x: 250, y: 190, expected: "paint" }, { name: "outside", x: 100, y: 280, expected: "background" }] },
  { id: "text-rtl", label: "Text / RTL direction", project: project("debug-text-rtl", [textLayer("text-rtl", "مرحبا بالعالم", { y: 120, fontSize: 64, textAnchor: "middle", direction: "rtl" })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "مرحبا بالعالم", x: 480, y: 190, fontSize: 64, textAnchor: "middle", direction: "rtl" }, svg: [], probes: [{ name: "center", x: 480, y: 190, expected: "paint" }, { name: "outside", x: 480, y: 290, expected: "background" }] },
  { id: "text-tspan-paint", label: "Text / tspan paint ranges", project: project("debug-text-tspan-paint", [textLayer("text-tspan-paint", "red blue", { x: 100, y: 120, fontSize: 64, spans: [{ start: 0, end: 4, id: "red-span", fill: "#fb7185" }, { start: 4, end: 8, id: "blue-span", fill: "#38bdf8" }] })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "red blue", x: 100, y: 190, fontSize: 64, spans: [{ text: "red ", fill: "#fb7185" }, { text: "blue", fill: "#38bdf8" }] }, svg: [], probes: [{ name: "text", x: 180, y: 190, expected: "paint" }, { name: "outside", x: 100, y: 280, expected: "background" }] },
  { id: "text-positioned", label: "Text / dx dy rotate", project: project("debug-text-positioned", [textLayer("text-positioned", "offset glyphs", { x: 120, y: 120, fontSize: 64, dx: [0, 8, 12, 0, -6], dy: [0, -8, 4, 0, 8], rotate: [0, -8, 8, -5, 0] })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "offset glyphs", x: 120, y: 190, fontSize: 64, dx: [0, 8, 12, 0, -6], dy: [0, -8, 4, 0, 8], rotate: [0, -8, 8, -5, 0] }, svg: [], probes: [{ name: "text", x: 200, y: 180, expected: "paint" }, { name: "outside", x: 120, y: 300, expected: "background" }] },
  { id: "text-baseline", label: "Text / baseline alignment", project: project("debug-text-baseline", [textLayer("text-baseline", "baseline middle", { x: 120, y: 120, fontSize: 64, spanStyle: { dominantBaseline: "middle", alignmentBaseline: "middle", baselineShift: { value: 6, unit: "px" } } })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "baseline middle", x: 120, y: 190, fontSize: 64, dominantBaseline: "middle", alignmentBaseline: "middle", baselineShift: "6px" }, svg: [], probes: [{ name: "text", x: 220, y: 185, expected: "paint" }, { name: "outside", x: 120, y: 300, expected: "background" }] },
  { id: "text-length-adjust", label: "Text / textLength spacingAndGlyphs", project: project("debug-text-length-adjust", [textLayer("text-length-adjust", "fixed measure", { x: 120, y: 120, fontSize: 64, spanStyle: { textLength: { value: 600, unit: "px" }, lengthAdjust: "spacingAndGlyphs" } })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "fixed measure", x: 120, y: 190, fontSize: 64, textLength: 600, lengthAdjust: "spacingAndGlyphs" }, svg: [], probes: [{ name: "text", x: 400, y: 190, expected: "paint" }, { name: "outside", x: 120, y: 300, expected: "background" }] },
  { id: "text-path", label: "Text / textPath reference", project: project("debug-text-path", [pathLayer("text-baseline-path", { start: { x: 100, y: 300 }, segments: [{ kind: "cubic", control1: { x: 260, y: 100 }, control2: { x: 420, y: 100 }, to: { x: 580, y: 300 } }, { kind: "cubic", control1: { x: 740, y: 500 }, control2: { x: 820, y: 500 }, to: { x: 900, y: 260 } }], closed: false }, { fill: "none", stroke: "#334155", strokeWidth: 3, strokeDash: { array: [8, 12], offset: 0 } }), { ...textLayer("text-path-label", "text on a path", { x: 0, y: 0, fontSize: 52, textPath: { pathId: "text-baseline-path", startOffset: 24 } }), order: 1 }], [], [TEXT_PREVIEW_FONT]), svgText: { text: "text on a path", x: 0, y: 0, fontSize: 52, textPathD: "M 100 300 C 260 100 420 100 580 300 S 820 500 900 260", textPathStartOffset: 24 }, svg: [{ d: "M 100 300 C 260 100 420 100 580 300 S 820 500 900 260", fill: "none", stroke: "#334155", strokeWidth: 3, dash: "8 12" }], probes: [{ name: "path", x: 340, y: 190, expected: "paint" }, { name: "outside", x: 120, y: 80, expected: "background" }] },
  { id: "text-vertical", label: "Text / vertical writing-mode", project: project("debug-text-vertical", [textLayer("text-vertical", "VERT", { x: 480, y: 80, fontSize: 64, writingMode: "vertical-rl" })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "VERT", x: 480, y: 90, fontSize: 64, writingMode: "vertical-rl" }, svg: [], probes: [{ name: "text", x: 480, y: 180, expected: "paint" }, { name: "outside", x: 300, y: 180, expected: "background" }] },
  { id: "text-font-variant", label: "Text / font style and stretch", project: project("debug-text-font-variant", [textLayer("text-font-variant", "italic expanded", { x: 100, y: 120, fontSize: 64, spanStyle: { font: { families: ["Noto Sans", "sans-serif"], weight: 700, style: "italic", stretch: "expanded" } } })], [], [TEXT_PREVIEW_FONT, TEXT_PREVIEW_BOLD_ITALIC_FONT]), svgText: { text: "italic expanded", x: 100, y: 190, fontSize: 64, fontWeight: 700, fontStyle: "italic", fontStretch: "expanded" }, svg: [], probes: [{ name: "text", x: 250, y: 190, expected: "paint" }, { name: "outside", x: 100, y: 300, expected: "background" }] },
  { id: "text-decoration", label: "Text / decoration", project: project("debug-text-decoration", [textLayer("text-decoration", "decorated text", { x: 100, y: 120, fontSize: 64, spanStyle: { textDecoration: { underline: { stroke: "#f97316", strokeWidth: { value: 4, unit: "px" } }, overline: { fill: "#38bdf8" }, lineThrough: { stroke: "#fb7185" } } } })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "decorated text", x: 100, y: 190, fontSize: 64, textDecoration: "underline overline line-through", stroke: undefined }, svg: [], probes: [{ name: "text", x: 220, y: 190, expected: "paint" }, { name: "outside", x: 100, y: 300, expected: "background" }] },
  { id: "text-stroke", label: "Text / stroke and paint-order", project: project("debug-text-stroke", [textLayer("text-stroke", "outlined type", { x: 100, y: 120, fontSize: 72, spanStyle: { fill: "#f8fafc", stroke: "#f43f5e", strokeWidth: { value: 4, unit: "px" }, paintOrder: ["stroke", "fill", "markers"] } })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "outlined type", x: 100, y: 200, fontSize: 72, stroke: "#f43f5e", strokeWidth: 4 }, svg: [], probes: [{ name: "text", x: 220, y: 200, expected: "paint" }, { name: "outside", x: 100, y: 320, expected: "background" }] },
  { id: "text-whitespace", label: "Text / preserved whitespace", project: project("debug-text-whitespace", [textLayer("text-whitespace", "  preserve   spaces", { x: 100, y: 120, fontSize: 64, whiteSpace: "preserve", textRendering: "geometricPrecision" })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "  preserve   spaces", x: 100, y: 190, fontSize: 64, whiteSpace: "pre", textRendering: "geometricPrecision" }, svg: [], probes: [{ name: "text", x: 260, y: 190, expected: "paint" }, { name: "outside", x: 100, y: 300, expected: "background" }] },
  { id: "text-word-spacing", label: "Text / word-spacing", project: project("debug-text-word-spacing", [textLayer("text-word-spacing", "word spacing", { x: 100, y: 120, fontSize: 64, letterSpacing: 2, wordSpacing: 18 })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "word spacing", x: 100, y: 190, fontSize: 64, letterSpacing: 2, wordSpacing: 18 }, svg: [], probes: [{ name: "text", x: 260, y: 190, expected: "paint" }, { name: "outside", x: 100, y: 300, expected: "background" }] },
  { id: "text-ligature-emoji", label: "Text / ligature and emoji fallback", project: project("debug-text-ligature-emoji", [textLayer("text-ligature-emoji", "office fi 👋", { x: 100, y: 120, fontSize: 64, spanStyle: { kerning: "auto", opticalSizing: "auto" } })], [], [TEXT_PREVIEW_FONT]), svgText: { text: "office fi 👋", x: 100, y: 190, fontSize: 64 }, svg: [], probes: [{ name: "text", x: 240, y: 190, expected: "paint" }, { name: "outside", x: 100, y: 300, expected: "background" }] },
];

export function pathRenderingFixtureById(id: string | null): PathRenderingFixture {
  return PATH_RENDERING_FIXTURES.find((fixture) => fixture.id === id) ?? PATH_RENDERING_FIXTURES[0];
}
