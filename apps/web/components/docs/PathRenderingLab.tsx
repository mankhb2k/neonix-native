"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PreviewStage } from "@/components/docs/PreviewStage";
import { PATH_RENDERING_FIXTURES, pathRenderingFixtureById, type PathRenderingFixture } from "@/lib/docs/path-rendering-fixtures";

type Measurement = { backend: string; bounds: string; paintedPixels: number; backgroundHoles: number; probes: Array<{ name: string; actual: string; expected: string }> };

function SvgReference({ fixture }: { fixture: PathRenderingFixture }) {
  return <svg viewBox="0 0 960 540" className="h-full w-full bg-[#101820]" aria-label="SVG reference">
    {fixture.svg.map((item) => <path key={item.d} d={item.d} fill={item.fill ?? "none"} fillOpacity={item.fillOpacity} stroke={item.stroke} strokeWidth={item.strokeWidth} strokeOpacity={item.strokeOpacity} strokeLinejoin={item.join} strokeLinecap={item.cap} strokeDasharray={item.dash} strokeDashoffset={item.dashOffset} />)}
  </svg>;
}

async function measureCanvas(canvas: HTMLCanvasElement, fixture: PathRenderingFixture): Promise<Measurement> {
  const image = new Image();
  image.src = canvas.toDataURL("image/png");
  await image.decode();
  const copy = document.createElement("canvas");
  copy.width = canvas.width; copy.height = canvas.height;
  const context = copy.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("2D measurement context is unavailable");
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, copy.width, copy.height).data;
  const isBackground = (x: number, y: number) => {
    const offset = (y * copy.width + x) * 4;
    return Math.abs(data[offset] - 16) < 5 && Math.abs(data[offset + 1] - 24) < 5 && Math.abs(data[offset + 2] - 32) < 5;
  };
  let left = copy.width; let top = copy.height; let right = -1; let bottom = -1; let paintedPixels = 0;
  for (let y = 0; y < copy.height; y += 1) for (let x = 0; x < copy.width; x += 1) {
    if (isBackground(x, y)) continue;
    paintedPixels += 1; left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  const probes = fixture.probes.map((probe) => {
    const background = isBackground(probe.x, probe.y);
    return { name: probe.name, actual: background ? "background" : "paint", expected: probe.expected };
  });
  return { backend: canvas.dataset.backend ?? "pending", bounds: right < 0 ? "none" : `${left},${top} → ${right},${bottom}`, paintedPixels, backgroundHoles: probes.filter((probe) => probe.expected === "paint" && probe.actual === "background").length, probes };
}

export function PathRenderingLab() {
  const [fixtureId, setFixtureId] = useState(PATH_RENDERING_FIXTURES[0].id);
  const fixture = useMemo(() => pathRenderingFixtureById(fixtureId), [fixtureId]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const canvases = ["path-debug-webgl2", "path-debug-webgpu"]
        .map((id) => document.querySelector<HTMLCanvasElement>(`[data-testid="${id}"]`))
        .filter((canvas): canvas is HTMLCanvasElement => canvas !== null);
      void Promise.all(canvases.map((canvas) => measureCanvas(canvas, fixture))).then(setMeasurements).catch(() => setMeasurements([]));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [fixture]);
  return <main className="min-h-screen bg-[#080c11] p-6 text-slate-200" data-testid="path-rendering-lab">
    <div className="mb-5 flex flex-wrap items-center gap-3"><h1 className="text-xl font-semibold">Path rendering parity lab</h1><Link className="text-cyan-300 underline" href="/docs/preview">Protocol preview</Link></div>
    <label className="mb-5 block text-sm">Case <select className="ml-2 rounded border border-slate-700 bg-slate-950 p-2" value={fixtureId} onChange={(event) => setFixtureId(event.target.value)}>{PATH_RENDERING_FIXTURES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <div className="grid gap-4 xl:grid-cols-3">
      <Panel title="SVG reference"><SvgReference fixture={fixture} /></Panel>
      <Panel title="WebGL2"><PreviewStage project={fixture.project} backend="webgl2" preserveDrawingBuffer testId="path-debug-webgl2" /></Panel>
      <Panel title="WebGPU"><PreviewStage project={fixture.project} backend="webgpu" preserveDrawingBuffer testId="path-debug-webgpu" /></Panel>
    </div>
    <div className="mt-5 grid gap-4 xl:grid-cols-2"><pre className="overflow-auto rounded border border-slate-800 bg-slate-950 p-4 text-xs">{JSON.stringify(fixture.project, null, 2)}</pre><pre className="overflow-auto rounded border border-slate-800 bg-slate-950 p-4 text-xs" data-testid="path-rendering-measurements">{JSON.stringify(measurements, null, 2)}</pre></div>
  </main>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded border border-slate-800"><h2 className="border-b border-slate-800 bg-slate-950 px-3 py-2 text-sm font-medium">{title}</h2><div className="relative h-[320px]">{children}</div></section>;
}
