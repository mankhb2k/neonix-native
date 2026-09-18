"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { publicRendererMessage } from "@/lib/public-renderer-message";

const WIDTH = 960;
const HEIGHT = 540;
const FIXTURE_COLORS = {
  cyan: { r: 34, g: 211, b: 238, a: 0.8 },
  purple: { r: 139, g: 92, b: 246, a: 0.8 },
} as const;

type LabCanvasKit = {
  MakeSurface(width: number, height: number): LabSkiaSurface | null;
  Color(r: number, g: number, b: number, a: number): unknown;
  Paint: new () => LabSkiaPaint;
  PaintStyle: { Fill: unknown; Stroke: unknown };
  Path: { MakeFromSVGString(value: string): LabSkiaPath | null };
  TRANSPARENT: unknown;
  AlphaType: { Unpremul: unknown };
  ColorType: { RGBA_8888: unknown };
  ColorSpace: { SRGB: unknown };
  Shader: { MakeLinearGradient(start: unknown, end: unknown, colors: unknown[], positions?: number[]): unknown };
  Typeface: { MakeTypefaceFromName(name: string, style?: unknown): LabTypeface | null };
  Font: new (typeface: LabTypeface, size: number) => LabFont;
};
type LabSkiaSurface = { getCanvas(): LabSkiaCanvas; flush(): void; dispose(): void };
type LabSkiaCanvas = { clear(color: unknown): void; drawRect(rect: unknown, paint: LabSkiaPaint): void; drawPath(path: LabSkiaPath, paint: LabSkiaPaint): void; drawCircle(x: number, y: number, radius: number, paint: LabSkiaPaint): void; readPixels(x: number, y: number, info: unknown): Uint8Array | null };
type LabSkiaPaint = { setAntiAlias(value: boolean): void; setColor(value: unknown): void; setStyle(value: unknown): void; setStrokeWidth(value: number): void; delete(): void };
type LabSkiaPath = { delete(): void };
type LabTypeface = { delete(): void };
type LabFont = { delete(): void };

const CASES = [
  { id: "shapes", label: "Shapes / fills", content: '<rect x="120" y="110" width="300" height="220" rx="24" fill="#22d3ee" opacity=".8"/><circle cx="650" cy="270" r="120" fill="#8b5cf6" opacity=".8"/>' },
  { id: "path", label: "Path / stroke", content: '<path d="M180 370 C260 120 390 120 480 270 S700 420 780 165" fill="none" stroke="#67e8f9" stroke-width="12" stroke-linecap="round"/>' },
  { id: "gradient", label: "Gradient / alpha", content: '<defs><linearGradient id="g"><stop stop-color="#22d3ee"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><rect x="92" y="80" width="776" height="380" rx="28" fill="url(#g)" opacity=".55"/><circle cx="480" cy="270" r="120" fill="#f8fafc" opacity=".65"/>' },
  { id: "text", label: "Text / font", content: '<text x="480" y="270" text-anchor="middle" fill="#f8fafc" font-family="sans-serif" font-size="44" font-weight="700">Native text next</text>' },
] as const;
function svgFixture(content: string): string {
 return `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>
  <rect width="960" height="540" fill="#080c14"/>
  ${content}
</svg>`;
}

export function SkiaPreviewLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [caseId, setCaseId] = useState<(typeof CASES)[number]["id"]>("shapes");
  const selectedCase = CASES.find((item) => item.id === caseId) ?? CASES[0];
  const [status, setStatus] = useState("Loading CanvasKit…");
  useEffect(() => {
    let disposed = false;
    let surface: LabSkiaSurface | null = null;
    let script: HTMLScriptElement | null = null;
    const run = async () => {
      const init = (window as Window & { CanvasKitInit?: unknown }).CanvasKitInit as unknown as ((options: { locateFile: (file: string) => string }) => Promise<LabCanvasKit>) | undefined;
      if (!init) {
        script = document.createElement("script");
        script.src = "/vendor/canvaskit/canvaskit.js";
        script.async = true;
        document.head.appendChild(script);
        await new Promise<void>((resolve, reject) => { script!.onload = () => resolve(); script!.onerror = () => reject(new Error("CanvasKit bootstrap failed")); });
      }
      const kit = await ((window as Window & { CanvasKitInit?: unknown }).CanvasKitInit as unknown as (options: { locateFile: (file: string) => string }) => Promise<LabCanvasKit>)({ locateFile: (file) => `/vendor/canvaskit/${file}` });
      if (disposed) return;
      surface = kit.MakeSurface(WIDTH, HEIGHT);
      if (!surface) throw new Error("CanvasKit could not create a raster surface");
      const canvas = surface.getCanvas();
      canvas.clear(kit.Color(8, 12, 20, 1));
      const fill = new kit.Paint(); fill.setAntiAlias(true); fill.setColor(kit.Color(FIXTURE_COLORS.cyan.r, FIXTURE_COLORS.cyan.g, FIXTURE_COLORS.cyan.b, FIXTURE_COLORS.cyan.a)); fill.setStyle(kit.PaintStyle.Fill);
      if (selectedCase.id === "shapes") {
        const rounded = kit.Path.MakeFromSVGString("M144 110 H396 A24 24 0 0 1 420 134 V306 A24 24 0 0 1 396 330 H144 A24 24 0 0 1 120 306 V134 A24 24 0 0 1 144 110 Z");
        if (rounded) { canvas.drawPath(rounded, fill); rounded.delete(); }
        const circlePaint = new kit.Paint(); circlePaint.setAntiAlias(true); circlePaint.setColor(kit.Color(FIXTURE_COLORS.purple.r, FIXTURE_COLORS.purple.g, FIXTURE_COLORS.purple.b, FIXTURE_COLORS.purple.a)); circlePaint.setStyle(kit.PaintStyle.Fill);
        const circle = kit.Path.MakeFromSVGString("M770 270 A120 120 0 1 1 530 270 A120 120 0 1 1 770 270 Z");
        if (circle) { canvas.drawPath(circle, circlePaint); circle.delete(); }
        circlePaint.delete();
      }
      if (selectedCase.id === "gradient") {
        const gradient = kit.Shader.MakeLinearGradient([0, 0], [960, 540], [kit.Color(34, 211, 238, .8), kit.Color(139, 92, 246, .8)], [0, 1]);
        if (gradient && "setShader" in fill) (fill as LabSkiaPaint & { setShader(shader: unknown): void }).setShader(gradient);
        canvas.drawRect([92, 80, 868, 460], fill);
      }
      fill.delete();
      const stroke = new kit.Paint(); stroke.setAntiAlias(true); stroke.setColor(kit.Color(103, 232, 249, 1)); stroke.setStyle(kit.PaintStyle.Stroke); stroke.setStrokeWidth(12);
      const path = kit.Path.MakeFromSVGString("M180 370 C260 120 390 120 480 270 S700 420 780 165");
      if (path && selectedCase.id === "path") {
        canvas.drawPath(path, stroke);
        const cap = new kit.Paint(); cap.setAntiAlias(true); cap.setColor(kit.Color(103, 232, 249, 1)); cap.setStyle(kit.PaintStyle.Fill);
        canvas.drawCircle(180, 370, 6, cap);
        canvas.drawCircle(780, 165, 6, cap);
        cap.delete();
      }
      path?.delete();
      stroke.delete();
      if (selectedCase.id === "text") {
        const typeface = kit.Typeface.MakeTypefaceFromName("Arial");
        if (typeface && "drawText" in canvas) {
          const font = new kit.Font(typeface, 44);
          const textPaint = new kit.Paint(); textPaint.setAntiAlias(true); textPaint.setColor(kit.Color(248, 250, 252, 1)); textPaint.setStyle(kit.PaintStyle.Fill);
          (canvas as LabSkiaCanvas & { drawText(text: string, x: number, y: number, font: LabFont, paint: LabSkiaPaint): void }).drawText("Native text next", 330, 285, font, textPaint);
          textPaint.delete(); font.delete(); typeface.delete();
        }
      }
      surface.flush();
      const target = canvasRef.current;
      const context = target?.getContext("2d");
      if (!target || !context) throw new Error("Canvas 2D target unavailable");
      target.width = WIDTH; target.height = HEIGHT;
      const pixels = surface.getCanvas().readPixels(0, 0, {
        width: WIDTH,
        height: HEIGHT,
        alphaType: kit.AlphaType.Unpremul,
        colorType: kit.ColorType.RGBA_8888,
        colorSpace: kit.ColorSpace.SRGB,
      });
      if (!pixels) throw new Error("CanvasKit surface returned no pixels");
      context.putImageData(new ImageData(new Uint8ClampedArray(pixels), WIDTH, HEIGHT), 0, 0);
      setStatus("Browser runtime loaded · baseline surface ready");
    };
    run().catch((error: unknown) => setStatus(publicRendererMessage(error instanceof Error ? error.message : String(error))));
    return () => { disposed = true; surface?.dispose(); };
  }, [selectedCase]);
  return <main className="min-h-[calc(100vh-4rem)] bg-[#07080c] px-4 py-6 text-slate-100 md:px-8">
    <header className="mx-auto mb-6 max-w-[1400px]"><p className="text-[11px] font-semibold tracking-[.18em] text-cyan-300 uppercase">Preview / Native renderer</p><h1 className="mt-2 text-2xl font-semibold">SVG vs native 2D preview</h1></header>
    <div className="mx-auto mb-5 flex max-w-[1400px] items-center gap-3"><label htmlFor="skia-case" className="text-xs text-slate-400">Test case</label><select id="skia-case" value={caseId} onChange={(event) => setCaseId(event.target.value as (typeof CASES)[number]["id"])} className="rounded-md border border-white/15 bg-[#101721] px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-300/60">{CASES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><span className="font-mono text-[11px] text-slate-500">{selectedCase.id}</span></div>
    <section className="mx-auto grid max-w-[1400px] gap-5 lg:grid-cols-2">
      <Panel title="Browser SVG reference" badge="SVG / browser"><iframe title="Browser SVG reference" srcDoc={svgFixture(selectedCase.content)} className="aspect-video w-full border-0 bg-[#080c14]" /></Panel>
      <Panel title="Native preview" badge="Browser runtime"><canvas ref={canvasRef} className="aspect-video w-full bg-[#080c14]" /><p className="border-t border-white/10 px-3 py-2 font-mono text-[11px] text-slate-500" data-testid="skia-status">{status}</p></Panel>
    </section>
  </main>;
}

function Panel({ title, badge, children }: { title: string; badge: string; children: ReactNode }) { return <article className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1118]"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><h2 className="text-sm font-medium">{title}</h2><span className="rounded bg-cyan-400/10 px-2 py-1 font-mono text-[10px] text-cyan-200">{badge}</span></div>{children}</article>; }
