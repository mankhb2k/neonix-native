import type { MotionProtocolV2, V2Filter } from "@motionvideo/motion-protocol/v2";

const transform = {
  translate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
  rotate: { x: 0, y: 0, z: 0 }, skew: { x: 0, y: 0 }, anchor: { x: 0, y: 0, z: 0 },
};

type SvgPath = { d: string; fill?: string; fillOpacity?: number; stroke?: string; strokeWidth?: number; strokeOpacity?: number; join?: "miter" | "bevel" | "round"; cap?: "butt" | "square" | "round"; dash?: string; dashOffset?: number };
type SvgFilterReference = { id: string; kind: "blur" | "drop-shadow" | "outer-glow" | "inner-glow" | "saturate" | "hue-rotate"; stdDeviation?: number };
export type PathRenderingFixture = { id: string; label: string; project: MotionProtocolV2; svg: SvgPath[]; svgFilter?: SvgFilterReference; probes: Array<{ name: string; x: number; y: number; expected: "paint" | "background" }> };
type PathPoint = { x: number; y: number };
type PathSegment =
  | { kind: "line"; to: PathPoint }
  | { kind: "quadratic"; control: PathPoint; to: PathPoint }
  | { kind: "cubic"; control1: PathPoint; control2: PathPoint; to: PathPoint }
  | { kind: "arc"; radii: { x: number; y: number }; rotation: number; largeArc: boolean; sweep: boolean; to: PathPoint };

function project(id: string, layers: MotionProtocolV2["layers"], filters: V2Filter[] = []): MotionProtocolV2 {
  return {
    format: "motion-protocol", formatVersion: 2, id,
    composition: { width: 960, height: 540, fps: 30, background: "#101820", colorSpace: "srgb", view: { projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 }, transform: { translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 } } } },
    assets: [], ...(filters.length ? { filters } : {}), audio: { sampleRate: 48000, tracks: [] }, layers,
  };
}

function pathLayer(id: string, d: { start: PathPoint; segments: PathSegment[]; closed: boolean }, style: Record<string, unknown>, filter?: string): MotionProtocolV2["layers"][number] {
  return { id, type: "path", parentLayerId: null, order: 0, frame: { width: 960, height: 540 }, transform, opacity: 1, timing: { start: 0, duration: 3000 }, ...(filter ? { filter } : {}), payload: { contours: [{ id: `${id}-contour`, ...d }], fillRule: "nonzero" }, style };
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

export const PATH_RENDERING_FIXTURES: PathRenderingFixture[] = [
  { id: "open-line", label: "Open line / butt cap", project: project("debug-open-line", [pathLayer("line", { start: { x: 220, y: 270 }, segments: [{ kind: "line", to: { x: 740, y: 270 } }], closed: false }, { stroke: "#ff3366", strokeWidth: 8, strokeCap: "butt" })]), svg: [{ d: "M 220 270 L 740 270", stroke: "#ff3366", strokeWidth: 8, cap: "butt" }], probes: [{ name: "center", x: 480, y: 270, expected: "paint" }, { name: "outside", x: 480, y: 250, expected: "background" }] },
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
];

export function pathRenderingFixtureById(id: string | null): PathRenderingFixture {
  return PATH_RENDERING_FIXTURES.find((fixture) => fixture.id === id) ?? PATH_RENDERING_FIXTURES[0];
}
