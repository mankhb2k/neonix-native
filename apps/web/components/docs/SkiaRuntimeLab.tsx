"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { compileProtocol } from "@motionvideo/motion-compiler";
import { evaluateRuntimeProjectV3, frameIndexAtTime } from "@motionvideo/motion-runtime";
import type { PaintCommand, PaintFill, PaintFillGradient, RuntimeFrameV3 } from "@motionvideo/motion-runtime";
import { SKIA_CLIP_CASES, SKIA_COMPOSITING_CASES, SKIA_EFFECT_CASES, SKIA_GRADIENT_CASES, SKIA_IMAGE_CASES, SKIA_MASK_CASES, SKIA_PREVIEW_CASES, SKIA_TEXT_CASES, SKIA_VIDEO_CASES } from "@/lib/docs/skia-preview-fixtures";
import { PreviewStage } from "./PreviewStage";

const CASES = [...SKIA_PREVIEW_CASES, ...SKIA_GRADIENT_CASES, ...SKIA_IMAGE_CASES, ...SKIA_VIDEO_CASES, ...SKIA_TEXT_CASES, ...SKIA_COMPOSITING_CASES, ...SKIA_CLIP_CASES, ...SKIA_MASK_CASES, ...SKIA_EFFECT_CASES];
const DEFAULT_CASE = CASES[0];
if (!DEFAULT_CASE) throw new Error("Skia preview fixtures are empty");

export function SkiaRuntimeLab() {
  const [caseId, setCaseId] = useState(CASES[0]?.id ?? "primitive.shape.rectangle");
  const selected = CASES.find((item) => item.id === caseId) ?? DEFAULT_CASE;
  const runtime = useMemo(() => compileProtocol(selected.project), [selected]);
  const previewTime = selected.previewTime ?? 0;
  const frame = useMemo(() => evaluateRuntimeProjectV3(runtime, frameIndexAtTime(previewTime, selected.project.composition.fps), { time: previewTime }), [previewTime, runtime, selected]);
  const [preparedFrame, setPreparedFrame] = useState<{ caseId: string; frame: RuntimeFrameV3 } | null>(null);
  const onFrameReady = useCallback((nextFrame: RuntimeFrameV3) => {
    setPreparedFrame((current) => current?.caseId === selected.id ? current : { caseId: selected.id, frame: nextFrame });
  }, [selected.id]);
  const referenceFrame = preparedFrame?.caseId === selected.id ? preparedFrame.frame : frame;
  return <main className="min-h-[calc(100vh-4rem)] bg-[#07080c] px-4 py-6 text-slate-100 md:px-8">
    <header className="mx-auto mb-5 max-w-[1400px]"><p className="text-[11px] font-semibold tracking-[.18em] text-cyan-300 uppercase">Preview / Skia / Runtime E2E</p><h1 className="mt-2 text-2xl font-semibold">Protocol V2 → Compiler → Runtime → Skia</h1><p className="mt-2 text-sm text-slate-400">{selected.label} · time {previewTime.toFixed(3)}s · {referenceFrame.commands.length} runtime commands</p></header>
    <div className="mx-auto mb-5 flex max-w-[1400px] items-center gap-3"><label htmlFor="runtime-skia-case" className="text-xs text-slate-400">Protocol fixture</label><select id="runtime-skia-case" value={caseId} onChange={(event) => setCaseId(event.target.value)} className="rounded-md border border-white/15 bg-[#101721] px-3 py-2 text-base text-slate-100">{CASES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><span className="font-mono text-[11px] text-slate-500">{selected.id}</span></div>
    <section className="mx-auto grid max-w-[1400px] gap-5 lg:grid-cols-2">
      <Panel title="Browser SVG reference" badge="SVG / same RuntimeFrameV3"><iframe title="Browser SVG reference" data-testid="skia-svg-reference" srcDoc={runtimeFrameToSvg(referenceFrame, selected.id)} className="aspect-video w-full border-0 bg-[#080c14]" /></Panel>
      <Panel title="Skia preview" badge="RuntimeFrameV3"><div className="aspect-video overflow-hidden"><PreviewStage project={selected.project} frame={frame} time={previewTime} backend="skia" testId="skia-runtime-stage" onFrameReady={onFrameReady} /></div></Panel>
    </section>
  </main>;
}

function Panel({ title, badge, children }: { title: string; badge: string; children: ReactNode }) { return <article className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1118]"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><h2 className="text-sm font-medium">{title}</h2><span className="rounded bg-cyan-400/10 px-2 py-1 font-mono text-[10px] text-cyan-200">{badge}</span></div>{children}</article>; }

function svgNumber(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

function svgEscape(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function svgPathData(command: Extract<PaintCommand, { op: "drawPath" }>): string {
  return command.contours.map((contour) => {
    let d = `M ${svgNumber(contour.start.x)} ${svgNumber(contour.start.y)}`;
    for (const segment of contour.segments) {
      if (segment.kind === "line") d += ` L ${svgNumber(segment.to.x)} ${svgNumber(segment.to.y)}`;
      else if (segment.kind === "quadratic") d += ` Q ${svgNumber(segment.control.x)} ${svgNumber(segment.control.y)} ${svgNumber(segment.to.x)} ${svgNumber(segment.to.y)}`;
      else if (segment.kind === "cubic") d += ` C ${svgNumber(segment.control1.x)} ${svgNumber(segment.control1.y)} ${svgNumber(segment.control2.x)} ${svgNumber(segment.control2.y)} ${svgNumber(segment.to.x)} ${svgNumber(segment.to.y)}`;
      else d += ` A ${svgNumber(segment.radii.x)} ${svgNumber(segment.radii.y)} ${svgNumber(segment.rotation)} ${segment.largeArc ? 1 : 0} ${segment.sweep ? 1 : 0} ${svgNumber(segment.to.x)} ${svgNumber(segment.to.y)}`;
    }
    return contour.closed ? `${d} Z` : d;
  }).join(" ");
}

function svgPolygonData(points: Array<{ x: number; y: number }>): string {
  return points.length === 0 ? "" : `M ${points.map((point) => `${svgNumber(point.x)} ${svgNumber(point.y)}`).join(" L ")} Z`;
}

type SvgRgba = [number, number, number, number];

function svgHexRgba(value: string): SvgRgba | null {
  const hex = value.startsWith("#") ? value.slice(1) : value;
  if (!/^(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
    hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
  ];
}

function svgGradientColorAt(gradient: PaintFillGradient, offset: number): { color: string; opacity: number } {
  const stops = gradient.stops;
  const rightIndex = stops.findIndex((stop) => stop.offset >= offset);
  const right = rightIndex < 0 ? stops[stops.length - 1] : stops[rightIndex];
  const left = rightIndex <= 0 ? right : stops[rightIndex - 1];
  if (!left || !right) return { color: "#000000", opacity: 1 };
  const leftColor = svgHexRgba(left.color);
  const rightColor = svgHexRgba(right.color);
  if (!leftColor || !rightColor || left === right || right.offset === left.offset) {
    return { color: right.color, opacity: right.stopOpacity ?? 1 };
  }
  const t = Math.max(0, Math.min(1, (offset - left.offset) / (right.offset - left.offset)));
  const rgba: SvgRgba = [
    leftColor[0] + (rightColor[0] - leftColor[0]) * t,
    leftColor[1] + (rightColor[1] - leftColor[1]) * t,
    leftColor[2] + (rightColor[2] - leftColor[2]) * t,
    leftColor[3] + (rightColor[3] - leftColor[3]) * t,
  ];
  const hex = `#${[rgba[0], rgba[1], rgba[2]].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
  const leftOpacity = left.stopOpacity ?? 1;
  const rightOpacity = right.stopOpacity ?? 1;
  return { color: hex, opacity: rgba[3] * (leftOpacity + (rightOpacity - leftOpacity) * t) };
}

function svgConicWedges(gradient: PaintFillGradient, width: number, height: number): string {
  const units = gradient.gradientUnits ?? "objectBoundingBox";
  const scaleX = units === "objectBoundingBox" ? width : 1;
  const scaleY = units === "objectBoundingBox" ? height : 1;
  const baseCenter: [number, number] = [gradient.cx ?? 0.5, gradient.cy ?? 0.5];
  const baseRadius = units === "objectBoundingBox" || gradient.gradientTransform ? 2 : Math.hypot(width, height) * 2;
  const mapPoint = (point: [number, number]): [number, number] => {
    const x = point[0] * scaleX;
    const y = point[1] * scaleY;
    const transform = gradient.gradientTransform;
    return transform
      ? [transform.a * x + transform.c * y + transform.e, transform.b * x + transform.d * y + transform.f]
      : [x, y];
  };
  const center = mapPoint(baseCenter);
  const start = ((gradient.from ?? 0) * Math.PI) / 180;
  const slices = 128;
  return Array.from({ length: slices }, (_, index) => {
    const t0 = index / slices;
    const t1 = (index + 1) / slices;
    const a0 = start + t0 * Math.PI * 2;
    const a1 = start + t1 * Math.PI * 2;
    const p0 = mapPoint([baseCenter[0] + Math.cos(a0) * baseRadius, baseCenter[1] + Math.sin(a0) * baseRadius]);
    const p1 = mapPoint([baseCenter[0] + Math.cos(a1) * baseRadius, baseCenter[1] + Math.sin(a1) * baseRadius]);
    const paint = svgGradientColorAt(gradient, (t0 + t1) / 2);
    return `<path d="M ${svgNumber(center[0])} ${svgNumber(center[1])} L ${svgNumber(p0[0])} ${svgNumber(p0[1])} L ${svgNumber(p1[0])} ${svgNumber(p1[1])} Z" fill="${svgEscape(paint.color)}" fill-opacity="${svgNumber(paint.opacity)}"/>`;
  }).join("");
}

function svgPaint(
  color: string | undefined,
  fillPaint: PaintFill | undefined,
  width: number,
  height: number,
  defs: string[],
  id: string,
): string {
  if (fillPaint?.type === "none") return "none";
  if (fillPaint?.type === "solid") return svgEscape(fillPaint.color);
  if (fillPaint?.type === "conic-gradient") {
    const units = fillPaint.gradientUnits ?? "objectBoundingBox";
    const scaleX = units === "objectBoundingBox" ? width : 1;
    const scaleY = units === "objectBoundingBox" ? height : 1;
    const baseCenter: [number, number] = [fillPaint.cx ?? 0.5, fillPaint.cy ?? 0.5];
    const baseRadius = units === "objectBoundingBox" ? 2 : Math.hypot(width, height) * 2;
    const mapConicPoint = (point: [number, number]): [number, number] => {
      const local: [number, number] = [point[0] * scaleX, point[1] * scaleY];
      const transform = fillPaint.gradientTransform;
      const transformed = transform
        ? [transform.a * local[0] + transform.c * local[1] + transform.e, transform.b * local[0] + transform.d * local[1] + transform.f]
        : local;
      return [transformed[0] / width, transformed[1] / height];
    };
    const [cx, cy] = mapConicPoint(baseCenter);
    const slices = 1024;
    const start = ((fillPaint.from ?? 0) * Math.PI) / 180;
    const wedges = Array.from({ length: slices }, (_, index) => {
      const t0 = index / slices;
      const t1 = (index + 1) / slices;
      const a0 = start + t0 * Math.PI * 2;
      const a1 = start + t1 * Math.PI * 2;
      const [x0, y0] = mapConicPoint([baseCenter[0] + Math.cos(a0) * baseRadius, baseCenter[1] + Math.sin(a0) * baseRadius]);
      const [x1, y1] = mapConicPoint([baseCenter[0] + Math.cos(a1) * baseRadius, baseCenter[1] + Math.sin(a1) * baseRadius]);
      const paint = svgGradientColorAt(fillPaint, (t0 + t1) / 2);
      return `<path d="M ${svgNumber(cx)} ${svgNumber(cy)} L ${svgNumber(x0)} ${svgNumber(y0)} L ${svgNumber(x1)} ${svgNumber(y1)} Z" fill="${svgEscape(paint.color)}" fill-opacity="${svgNumber(paint.opacity)}"/>`;
    }).join("");
    defs.push(`<pattern id="${svgEscape(id)}" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" x="0" y="0" width="1" height="1">${wedges}</pattern>`);
    return `url(#${svgEscape(id)})`;
  }
  if (fillPaint?.type === "radial-gradient") {
    const units = fillPaint.gradientUnits ?? "objectBoundingBox";
    const transform = fillPaint.gradientTransform;
    const transformAttribute = transform
      ? ` gradientTransform="matrix(${svgNumber(transform.a)} ${svgNumber(transform.b)} ${svgNumber(transform.c)} ${svgNumber(transform.d)} ${svgNumber(transform.e)} ${svgNumber(transform.f)})"`
      : "";
    const cx = fillPaint.cx ?? (units === "objectBoundingBox" ? 0.5 : width / 2);
    const cy = fillPaint.cy ?? (units === "objectBoundingBox" ? 0.5 : height / 2);
    const radius = fillPaint.radius ?? (units === "objectBoundingBox" ? 0.5 : Math.min(width, height) / 2);
    const fx = fillPaint.fx;
    const fy = fillPaint.fy;
    const fr = fillPaint.fr;
    const focus = fx === undefined && fy === undefined && fr === undefined
      ? ""
      : ` fx="${svgNumber(fx ?? cx)}" fy="${svgNumber(fy ?? cy)}" fr="${svgNumber(fr ?? 0)}"`;
    const stops = fillPaint.stops.map((stop) => `<stop offset="${svgNumber(stop.offset)}" stop-color="${svgEscape(stop.color)}"${stop.stopOpacity === undefined ? "" : ` stop-opacity="${svgNumber(stop.stopOpacity)}"`}/>`).join("");
    defs.push(`<radialGradient id="${svgEscape(id)}" gradientUnits="${units}" cx="${svgNumber(cx)}" cy="${svgNumber(cy)}" r="${svgNumber(radius)}"${focus}${transformAttribute}>${stops}</radialGradient>`);
    return `url(#${svgEscape(id)})`;
  }
  if (fillPaint?.type !== "linear-gradient") return svgEscape(color ?? "none");
  const units = fillPaint.gradientUnits ?? "objectBoundingBox";
  const transform = fillPaint.gradientTransform;
  const transformAttribute = transform
    ? ` gradientTransform="matrix(${svgNumber(transform.a)} ${svgNumber(transform.b)} ${svgNumber(transform.c)} ${svgNumber(transform.d)} ${svgNumber(transform.e)} ${svgNumber(transform.f)})"`
    : "";
  const x1 = fillPaint.x1 ?? (units === "objectBoundingBox" ? 0 : 0);
  const y1 = fillPaint.y1 ?? (units === "objectBoundingBox" ? 0 : 0);
  const x2 = fillPaint.x2 ?? (units === "objectBoundingBox" ? 1 : width);
  const y2 = fillPaint.y2 ?? (units === "objectBoundingBox" ? 1 : height);
  const stops = fillPaint.stops.map((stop) => `<stop offset="${svgNumber(stop.offset)}" stop-color="${svgEscape(stop.color)}"${stop.stopOpacity === undefined ? "" : ` stop-opacity="${svgNumber(stop.stopOpacity)}"`}/>`).join("");
  defs.push(`<linearGradient id="${id}" gradientUnits="${units}" x1="${svgNumber(x1)}" y1="${svgNumber(y1)}" x2="${svgNumber(x2)}" y2="${svgNumber(y2)}"${transformAttribute}>${stops}</linearGradient>`);
  return `url(#${id})`;
}

function svgStrokeAttributes(
  command: Extract<PaintCommand, { op: "drawPath" | "drawShape" }>,
  defs: string[],
): string {
  if (!command.stroke) return " stroke=\"none\"";
  const paintOpacity = command.strokePaint?.type === "solid" ? command.strokePaint.opacity ?? 1 : 1;
  return ` stroke="${svgPaint(command.stroke, command.strokePaint, command.width ?? 1, command.height ?? 1, defs, `${command.key}-stroke`)}" stroke-width="${svgNumber(command.strokeWidth ?? 1)}" stroke-opacity="${svgNumber((command.strokeOpacity ?? 1) * paintOpacity)}" stroke-linecap="${command.strokeCap ?? "butt"}" stroke-linejoin="${command.strokeJoin ?? "miter"}"`;
}

function svgTextGlyphMatrix(glyph: NonNullable<Extract<PaintCommand, { op: "drawText" }>["glyphs"]>[number], pathScale = glyph.pathScale, outline = glyph.outline): [number, number, number, number, number, number] {
  const scaleX = glyph.scaleX ?? 1;
  const sx = pathScale * scaleX;
  const sy = -pathScale;
  const baseE = glyph.x - outline.x * sx;
  const baseF = glyph.y + outline.y * pathScale;
  const radians = ((glyph.rotation ?? 0) * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    cosine * sx,
    sine * sx,
    -sine * sy,
    cosine * sy,
    glyph.x - cosine * glyph.x + sine * glyph.y + cosine * baseE - sine * baseF,
    sine * baseE + cosine * baseF + glyph.y - sine * glyph.x - cosine * glyph.y,
  ];
}

function svgBytesBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function svgTextGlyphPaint(
  glyph: NonNullable<Extract<PaintCommand, { op: "drawText" }>["glyphs"]>[number],
  command: Extract<PaintCommand, { op: "drawText" }>,
  defs: string[],
  id: string,
): string {
  return svgPaint(glyph.fill ?? command.fill, glyph.fill ? undefined : command.fillPaint, command.width, command.height, defs, id);
}

function svgTextGlyph(
  glyph: NonNullable<Extract<PaintCommand, { op: "drawText" }>["glyphs"]>[number],
  command: Extract<PaintCommand, { op: "drawText" }>,
  defs: string[],
  index: number,
): string {
  const matrix = svgTextGlyphMatrix(glyph).map(svgNumber).join(" ");
  const colorGlyph = glyph.colorGlyph;
  if (colorGlyph?.kind === "paint-graph" && glyph.colorGlyphFallback) {
    const fallback = glyph.colorGlyphFallback;
    return `<image x="${svgNumber(glyph.x)}" y="${svgNumber(glyph.y)}" width="${svgNumber(glyph.width)}" height="${svgNumber(glyph.height)}" preserveAspectRatio="none" href="data:${fallback.mimeType};base64,${svgBytesBase64(fallback.bytes)}"/>`;
  }
  if (colorGlyph?.kind === "bitmap") {
    return `<image x="${svgNumber(glyph.x)}" y="${svgNumber(glyph.y)}" width="${svgNumber(glyph.width)}" height="${svgNumber(glyph.height)}" preserveAspectRatio="none" href="data:${colorGlyph.mimeType};base64,${svgBytesBase64(colorGlyph.bytes)}"/>`;
  }
  if (colorGlyph?.kind === "layers") {
    const layers = colorGlyph.layers.map((layer) => {
      if (!layer.path || layer.pathScale === undefined || !layer.outline || layer.x === undefined || layer.y === undefined) return "";
      const layerMatrix = svgTextGlyphMatrix(glyph, layer.pathScale, { x: layer.outline.x, y: layer.outline.y, width: 0, height: 0 });
      layerMatrix[4] += layer.x - glyph.x;
      layerMatrix[5] += layer.y - glyph.y;
      return `<path d="${svgEscape(layer.path)}" transform="matrix(${layerMatrix.map(svgNumber).join(" ")})" fill="${svgEscape(layer.fill)}"/>`;
    }).join("");
    if (layers) return layers;
  }
  const stroke = glyph.stroke
    ? ` stroke="${svgPaint(glyph.stroke, glyph.strokePaint, command.width, command.height, defs, `${command.key}-text-stroke-${index}`)}" stroke-width="${svgNumber(glyph.strokeWidth ?? 1)}" stroke-opacity="${svgNumber(glyph.strokeOpacity ?? 1)}" stroke-linejoin="round"`
    : "";
  return `<path d="${svgEscape(glyph.path)}" transform="matrix(${matrix})" fill="${svgTextGlyphPaint(glyph, command, defs, `${command.key}-text-fill-${index}`)}"${stroke}/>`;
}

function svgImagePreserveAspectRatio(
  preserveAspectRatio: Extract<PaintCommand, { op: "drawImage" }>['preserveAspectRatio'],
): string {
  const align = preserveAspectRatio?.align ?? "xMidYMid";
  if (align === "none") return "none";
  return `${preserveAspectRatio?.defer ? "defer " : ""}${align} ${preserveAspectRatio?.meetOrSlice ?? "meet"}`;
}

type SvgColorMatrix = number[];

function svgMultiplyColorMatrices(left: SvgColorMatrix, right: SvgColorMatrix): SvgColorMatrix {
  const result = new Array<number>(20).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      for (let inner = 0; inner < 4; inner += 1) result[row * 5 + column] += left[row * 5 + inner] * right[inner * 5 + column];
    }
    result[row * 5 + 4] = left[row * 5 + 4]!;
    for (let inner = 0; inner < 4; inner += 1) result[row * 5 + 4] += left[row * 5 + inner] * right[inner * 5 + 4];
  }
  return result;
}

function svgColorAdjustMatrix(op: { brightness: number; contrast: number; saturation: number; hueRotate: number }): string {
  const lumR = 0.2126;
  const lumG = 0.7152;
  const lumB = 0.0722;
  const identity = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  let matrix = svgMultiplyColorMatrices([
    lumR * (1 - op.saturation) + op.saturation, lumG * (1 - op.saturation), lumB * (1 - op.saturation), 0, 0,
    lumR * (1 - op.saturation), lumG * (1 - op.saturation) + op.saturation, lumB * (1 - op.saturation), 0, 0,
    lumR * (1 - op.saturation), lumG * (1 - op.saturation), lumB * (1 - op.saturation) + op.saturation, 0, 0,
    0, 0, 0, 1, 0,
  ], identity);
  const angle = op.hueRotate * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  matrix = svgMultiplyColorMatrices([
    lumR + cosine * (1 - lumR) - sine * lumR, lumG * (1 - cosine) - sine * lumG, lumB * (1 - cosine) + sine * (1 - lumB), 0, 0,
    lumR * (1 - cosine) + sine * 0.143, lumG + cosine * (1 - lumG) + sine * 0.140, lumB * (1 - cosine) - sine * 0.283, 0, 0,
    lumR * (1 - cosine) - sine * (1 - lumR), lumG * (1 - cosine) + sine * lumG, lumB + cosine * (1 - lumB) + sine * lumB, 0, 0,
    0, 0, 0, 1, 0,
  ], matrix);
  const contrastOffset = 0.5 * (1 - op.contrast);
  matrix = svgMultiplyColorMatrices([
    op.contrast, 0, 0, 0, contrastOffset,
    0, op.contrast, 0, 0, contrastOffset,
    0, 0, op.contrast, 0, contrastOffset,
    0, 0, 0, 1, 0,
  ], matrix);
  matrix = svgMultiplyColorMatrices([
    1, 0, 0, 0, op.brightness,
    0, 1, 0, 0, op.brightness,
    0, 0, 1, 0, op.brightness,
    0, 0, 0, 1, 0,
  ], matrix);
  return matrix.map(svgNumber).join(" ");
}

function svgEffectFilter(
  command: Extract<PaintCommand, { op: "beginLayer" }>,
  defs: string[],
): string | undefined {
  const program = command.effectProgram;
  if (!program) return undefined;
  const ops = program.ops;
  const filterId = `${command.key}-runtime-effect`;
  const color = ops.find((op) => op.kind === "tint");
  const blur = ops.find((op) => op.kind === "blur");
  const offset = ops.find((op) => op.kind === "offset");
  let content = "";
  if (ops.length === 5 && ops[0]?.kind === "alpha-mask" && ops[1]?.kind === "blur" && ops[2]?.kind === "tint" && ops[3]?.kind === "offset" && ops[4]?.kind === "composite" && color?.kind === "tint" && blur?.kind === "blur" && offset?.kind === "offset") {
    content = `<feDropShadow dx="${svgNumber(offset.x)}" dy="${svgNumber(offset.y)}" stdDeviation="${svgNumber(blur.radius)}" flood-color="${svgEscape(color.color)}" flood-opacity="${svgNumber(color.opacity)}"/>`;
  } else if (ops.length === 4 && ops[0]?.kind === "alpha-mask" && ops[1]?.kind === "blur" && ops[2]?.kind === "tint" && ops[3]?.kind === "composite" && color?.kind === "tint" && blur?.kind === "blur") {
    content = `<feDropShadow dx="0" dy="0" stdDeviation="${svgNumber(blur.radius)}" flood-color="${svgEscape(color.color)}" flood-opacity="${svgNumber(color.opacity)}"/>`;
  } else if (ops.length === 5 && ops[0]?.kind === "alpha-mask" && ops[1]?.kind === "blur" && ops[2]?.kind === "inner-alpha" && ops[3]?.kind === "tint" && ops[4]?.kind === "composite" && color?.kind === "tint" && blur?.kind === "blur") {
    content = `<feGaussianBlur in="SourceAlpha" stdDeviation="${svgNumber(blur.radius)}" result="runtime-blur"/><feComposite in="SourceAlpha" in2="runtime-blur" operator="out" result="runtime-inside"/><feFlood flood-color="${svgEscape(color.color)}" flood-opacity="${svgNumber(color.opacity)}" result="runtime-tint"/><feComposite in="runtime-tint" in2="runtime-inside" operator="in" result="runtime-glow"/><feComposite in="SourceGraphic" in2="runtime-glow" operator="over"/>`;
  } else if (ops.length === 1 && ops[0]?.kind === "noise") {
    const noise = ops[0];
    const strength = noise.amount * noise.opacity;
    const intercept = 0.5 - strength;
    content = `<feTurbulence type="fractalNoise" baseFrequency="${svgNumber(1 / Math.max(noise.scale, 0.25))}" numOctaves="1" seed="${svgNumber(noise.seed)}" result="runtime-noise-source"/><feColorMatrix in="runtime-noise-source" type="saturate" values="0" result="runtime-noise-gray"/><feComponentTransfer in="runtime-noise-gray" result="runtime-noise-adjusted"><feFuncR type="linear" slope="${svgNumber(strength * 2)}" intercept="${svgNumber(intercept)}"/><feFuncG type="linear" slope="${svgNumber(strength * 2)}" intercept="${svgNumber(intercept)}"/><feFuncB type="linear" slope="${svgNumber(strength * 2)}" intercept="${svgNumber(intercept)}"/></feComponentTransfer><feComposite in="runtime-noise-adjusted" in2="SourceGraphic" operator="in" result="runtime-noise-masked"/><feBlend in="SourceGraphic" in2="runtime-noise-masked" mode="overlay"/>`;
  } else if (ops.every((op) => op.kind === "blur" || op.kind === "color-adjust")) {
    let input = "SourceGraphic";
    content = ops.map((op, index) => {
      const result = `runtime-effect-${index}`;
      const item = op.kind === "blur"
        ? `<feGaussianBlur in="${input}" stdDeviation="${svgNumber(op.radius)}" result="${result}"/>`
        : `<feColorMatrix in="${input}" type="matrix" values="${svgColorAdjustMatrix(op)}" result="${result}"/>`;
      input = result;
      return item;
    }).join("");
  }
  if (!content) return undefined;
  // Runtime high-level color-adjust effects default to the same sRGB domain
  // used by CanvasKit. SVG otherwise defaults filter interpolation to
  // linearRGB, which becomes visibly different for high-contrast operations.
  // Explicit Runtime metadata still wins for lowered SVG filter graphs.
  const colorInterpolation = ops.find((op) => op.kind === "color-adjust")?.colorInterpolationFilters ?? "sRGB";
  defs.push(`<filter id="${svgEscape(filterId)}" color-interpolation-filters="${colorInterpolation}" x="-100%" y="-100%" width="300%" height="300%">${content}</filter>`);
  return `url(#${svgEscape(filterId)})`;
}

function svgDrawCommand(command: PaintCommand, defs: string[]): string {
  if (command.op === "drawSolid") return `<rect width="${svgNumber(command.width)}" height="${svgNumber(command.height)}" fill="${svgEscape(command.fill)}"/>`;
  if (command.op === "drawShape") {
    if (command.fillPaint?.type === "conic-gradient") {
      const clipId = `${command.key}-conic-clip`;
      const clipShape = command.shape === "ellipse"
        ? `<ellipse cx="${svgNumber(command.width / 2)}" cy="${svgNumber(command.height / 2)}" rx="${svgNumber(command.width / 2)}" ry="${svgNumber(command.height / 2)}"/>`
        : command.shape === "polygon"
          ? `<path d="${svgPolygonData(command.points ?? [])}"/>`
          : `<rect width="${svgNumber(command.width)}" height="${svgNumber(command.height)}" rx="${svgNumber(command.cornerRadius ?? 0)}" ry="${svgNumber(command.cornerRadius ?? 0)}"/>`;
      defs.push(`<clipPath id="${svgEscape(clipId)}">${clipShape}</clipPath>`);
      const fillOpacity = (command.fillOpacity ?? 1);
      const outline = command.shape === "ellipse"
        ? `<ellipse cx="${svgNumber(command.width / 2)}" cy="${svgNumber(command.height / 2)}" rx="${svgNumber(command.width / 2)}" ry="${svgNumber(command.height / 2)}" fill="none"${svgStrokeAttributes(command, defs)}/>`
        : command.shape === "polygon"
          ? `<path d="${svgPolygonData(command.points ?? [])}" fill="none"${svgStrokeAttributes(command, defs)}/>`
          : `<rect width="${svgNumber(command.width)}" height="${svgNumber(command.height)}" rx="${svgNumber(command.cornerRadius ?? 0)}" ry="${svgNumber(command.cornerRadius ?? 0)}" fill="none"${svgStrokeAttributes(command, defs)}/>`;
      return `<g clip-path="url(#${svgEscape(clipId)})" opacity="${svgNumber(fillOpacity)}">${svgConicWedges(command.fillPaint, command.width, command.height)}</g>${outline}`;
    }
    const fill = svgPaint(command.fill, command.fillPaint, command.width, command.height, defs, `${command.key}-fill`);
    const opacity = svgNumber((command.fillOpacity ?? 1) * (command.fillPaint?.type === "solid" ? command.fillPaint.opacity ?? 1 : 1));
    const stroke = svgStrokeAttributes(command, defs);
    if (command.shape === "ellipse") return `<ellipse cx="${svgNumber(command.width / 2)}" cy="${svgNumber(command.height / 2)}" rx="${svgNumber(command.width / 2)}" ry="${svgNumber(command.height / 2)}" fill="${fill}" fill-opacity="${opacity}"${stroke}/>`;
    if (command.shape === "polygon") return `<path d="${svgPolygonData(command.points ?? [])}" fill="${fill}" fill-opacity="${opacity}"${stroke}/>`;
    return `<rect width="${svgNumber(command.width)}" height="${svgNumber(command.height)}" rx="${svgNumber(command.cornerRadius ?? 0)}" ry="${svgNumber(command.cornerRadius ?? 0)}" fill="${fill}" fill-opacity="${opacity}"${stroke}/>`;
  }
  if (command.op === "drawPath") {
    if (command.fillPaint?.type === "conic-gradient") {
      const width = command.width ?? 1;
      const height = command.height ?? 1;
      const clipId = `${command.key}-conic-clip`;
      const path = svgPathData(command);
      defs.push(`<clipPath id="${svgEscape(clipId)}"><path d="${path}" fill-rule="${command.fillRule}"/></clipPath>`);
      const fillOpacity = command.fillOpacity ?? 1;
      return `<g clip-path="url(#${svgEscape(clipId)})" opacity="${svgNumber(fillOpacity)}">${svgConicWedges(command.fillPaint, width, height)}</g><path d="${path}" fill="none"${svgStrokeAttributes(command, defs)}/>`;
    }
    const fill = command.fill ? svgPaint(command.fill, command.fillPaint, command.width ?? 1, command.height ?? 1, defs, `${command.key}-fill`) : "none";
    const fillOpacity = svgNumber((command.fillOpacity ?? 1) * (command.fillPaint?.type === "solid" ? command.fillPaint.opacity ?? 1 : 1));
    return `<path d="${svgPathData(command)}" fill="${fill}" fill-rule="${command.fillRule}" fill-opacity="${fillOpacity}"${svgStrokeAttributes(command, defs)}/>`;
  }
  if (command.op === "drawImage") {
    if (!command.uri) return "";
    const imageRendering = command.imageRendering ? ` image-rendering="${svgEscape(command.imageRendering)}"` : "";
    return `<image x="${svgNumber(command.x)}" y="${svgNumber(command.y)}" width="${svgNumber(command.width)}" height="${svgNumber(command.height)}" preserveAspectRatio="${svgImagePreserveAspectRatio(command.preserveAspectRatio)}" href="${svgEscape(command.uri)}"${imageRendering}/>`;
  }
  if (command.op === "drawVideo") {
    if (!command.uri) return "";
    const objectFit = command.fit === "contain" ? "contain" : command.fit === "cover" ? "cover" : command.fit === "none" ? "none" : "fill";
    return `<foreignObject x="0" y="0" width="${svgNumber(command.width)}" height="${svgNumber(command.height)}"><video xmlns="http://www.w3.org/1999/xhtml" data-runtime-media-time="${svgNumber(command.mediaTime)}" src="${svgEscape(command.uri)}" muted="muted" playsinline="playsinline" preload="auto" style="display:block;width:100%;height:100%;object-fit:${objectFit};background:transparent"></video></foreignObject>`;
  }
  if (command.op === "drawText") {
    const glyphs = (command.glyphs ?? []).map((glyph, index) => svgTextGlyph(glyph, command, defs, index)).join("");
    const decorations = (command.decorations ?? []).map((item, index) => `<rect x="${svgNumber(item.x)}" y="${svgNumber(item.y)}" width="${svgNumber(item.width)}" height="${svgNumber(item.height)}" fill="${svgPaint(item.fill, item.fillPaint, command.width, command.height, defs, `${command.key}-decoration-${index}`)}" fill-opacity="${svgNumber(item.opacity ?? 1)}"/>`).join("");
    return `${glyphs}${decorations}`;
  }
  return "";
}

function runtimeFrameToSvg(frame: RuntimeFrameV3, fixtureId?: string): string {
  const begin = frame.commands.find((command): command is Extract<PaintCommand, { op: "beginFrame" }> => command.op === "beginFrame");
  const width = begin?.width ?? 1;
  const height = begin?.height ?? 1;
  const defs: string[] = [];
  const body: string[] = [];
  const sourceCommands = new Map<string, { command: Extract<PaintCommand, { op: "drawPath" }>; transform: Extract<PaintCommand, { op: "setTransform" }> | null }>();
  let sourceTransform: Extract<PaintCommand, { op: "setTransform" }> | null = null;
  for (const command of frame.commands) {
    if (command.op === "setTransform") sourceTransform = command;
    else if (command.op === "drawPath") {
      sourceCommands.set(command.key, { command, transform: sourceTransform });
      sourceTransform = null;
    } else if (command.op !== "beginFrame" && command.op !== "endFrame") sourceTransform = null;
  }
  let pendingTransform: Extract<PaintCommand, { op: "setTransform" }> | null = null;
  const groupStack: string[] = [];
  const clipSourceKeys = new Set<string>();
  const maskSourceKeys = new Set<string>();
  const blendCss = (value: string | undefined): string => value === "normal" || value === undefined ? "normal" : value;
  const svgMatrix = (matrix: readonly number[] | undefined): string => {
    if (!matrix || matrix.length !== 16 || !matrix.every(Number.isFinite)) return "";
    return `matrix(${svgNumber(matrix[0])} ${svgNumber(matrix[1])} ${svgNumber(matrix[4])} ${svgNumber(matrix[5])} ${svgNumber(matrix[12])} ${svgNumber(matrix[13])})`;
  };
  for (const command of frame.commands) {
    if (command.op === "beginFrame") {
      body.push(`<rect width="${svgNumber(width)}" height="${svgNumber(height)}" fill="${svgEscape(command.background ?? "#000000")}"/>`);
    } else if (command.op === "beginGroup") {
      body.push(`<g data-runtime-group="${svgEscape(command.key)}">`);
      groupStack.push("group");
    } else if (command.op === "endGroup") {
      if (groupStack.pop()) body.push("</g>");
    } else if (command.op === "beginLayer") {
      const attributes: string[] = [`data-runtime-layer="${svgEscape(command.key)}"`];
      if (command.compositeAlpha !== undefined) attributes.push(`opacity="${svgNumber(command.compositeAlpha)}"`);
      const blend = blendCss(command.blendMode);
      const styles = [command.isolation ? "isolation:isolate" : "", blend !== "normal" ? `mix-blend-mode:${svgEscape(blend)}` : ""].filter(Boolean);
      if (styles.length) attributes.push(`style="${styles.join(";")}"`);
      const effectFilter = svgEffectFilter(command, defs);
      if (effectFilter) attributes.push(`filter="${effectFilter}"`);
      if (command.clipPath) {
        const sources = command.clipPath.sourceKeys ?? [command.clipPath.sourceKey];
        const clipId = `${command.key}-runtime-clip`;
        const paths = sources.map((sourceKey) => {
          const source = sourceCommands.get(sourceKey);
          if (!source) return "";
          const transform = svgMatrix(source.transform?.matrix4);
          return `<path d="${svgPathData(source.command)}" fill="#fff"${transform ? ` transform="${transform}"` : ""}/>`;
        }).join("");
        defs.push(`<clipPath id="${svgEscape(clipId)}" clipPathUnits="userSpaceOnUse">${paths}</clipPath>`);
        attributes.push(`clip-path="url(#${svgEscape(clipId)})"`);
        for (const sourceKey of sources) clipSourceKeys.add(sourceKey);
      }
      if (command.mask) {
        const sources = command.mask.sourceKeys ?? [command.mask.sourceKey];
        const maskId = `${command.key}-runtime-mask`;
        const paths = sources.map((sourceKey) => {
          const source = sourceCommands.get(sourceKey);
          if (!source) return "";
          const transform = svgMatrix(source.transform?.matrix4);
          const sourceFill = source.command.fill ?? "#000000";
          const opacity = (source.command.fillOpacity ?? 1) * (source.command.fillPaint?.type === "solid" ? source.command.fillPaint.opacity ?? 1 : 1);
          return `<path d="${svgPathData(source.command)}" fill="${svgEscape(sourceFill)}" fill-opacity="${svgNumber(opacity)}"${transform ? ` transform="${transform}"` : ""}/>`;
        }).join("");
        const maskType = command.mask.mode === "luma" ? ` style="mask-type:luminance"` : "";
        defs.push(`<mask id="${svgEscape(maskId)}" maskUnits="userSpaceOnUse" x="0" y="0" width="${svgNumber(width)}" height="${svgNumber(height)}"${maskType}>${paths}</mask>`);
        attributes.push(`mask="url(#${svgEscape(maskId)})"`);
        for (const sourceKey of sources) maskSourceKeys.add(sourceKey);
      }
      body.push(`<g ${attributes.join(" ")}>`);
      groupStack.push("layer");
    } else if (command.op === "setTransform") {
      pendingTransform = command;
    } else if (command.op === "endLayer") {
      if (groupStack.pop()) body.push("</g>");
      pendingTransform = null;
    } else {
      if (command.op === "drawPath" && (clipSourceKeys.has(command.key) || maskSourceKeys.has(command.key))) {
        pendingTransform = null;
        continue;
      }
      const drawable = svgDrawCommand(command, defs);
      if (!drawable) continue;
      if (!pendingTransform) {
        body.push(drawable);
        continue;
      }
      const matrix = svgMatrix(pendingTransform.matrix4);
      if (matrix && pendingTransform.visible && pendingTransform.alpha > 0) {
        body.push(`<g transform="${matrix}" opacity="${svgNumber(pendingTransform.alpha)}">${drawable}</g>`);
      }
      pendingTransform = null;
    }
  }
  const fixtureAttribute = fixtureId ? ` data-fixture="${svgEscape(fixtureId)}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg"${fixtureAttribute} data-runtime-frame="${svgNumber(frame.frame)}" data-runtime-time="${svgNumber(frame.time)}" width="${svgNumber(width)}" height="${svgNumber(height)}" viewBox="0 0 ${svgNumber(width)} ${svgNumber(height)}"><style>html,body,svg{margin:0;width:100%;height:100%;display:block;overflow:hidden}</style>${defs.length ? `<defs>${defs.join("")}</defs>` : ""}${body.join("")}</svg>`;
}
