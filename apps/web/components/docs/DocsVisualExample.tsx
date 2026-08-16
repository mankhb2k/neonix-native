"use client";

import { useMemo, useState } from "react";
import { DocsPixiPreview, docsStageViewBox } from "@/components/docs/DocsPixiPreview";
import type { DocsVisualVariant } from "@/lib/docs/visual-fixtures";

export type DocsOverlayKind = "none" | "origin" | "frame";

export function DocsVisualExample({
  path,
  overlay = "none",
  play = false,
  variants,
}: {
  path: string;
  overlay?: DocsOverlayKind;
  play?: boolean;
  variants: DocsVisualVariant[];
}) {
  const [id, setId] = useState(variants[0]?.id ?? "");
  const selected = variants.find((item) => item.id === id) ?? variants[0];

  if (!selected) return null;

  return (
    <section id="preview" className="my-8 overflow-hidden rounded-xl border border-[var(--border-subtle,#e4e4e7)]">
      <div className="grid grid-cols-1 bg-[var(--bg-surface)] sm:grid-cols-3">
        {variants.map((item) => {
          const active = item.id === selected.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setId(item.id)}
              className={`min-w-0 cursor-pointer text-left ${
                active
                  ? "ring-2 ring-inset ring-[var(--accent)]"
                  : "ring-1 ring-inset ring-transparent"
              }`}
            >
              <p className="px-3 pt-3 font-mono text-[11px] text-[var(--fg-muted)]">
                {item.label}
              </p>
              <div className="relative">
                <DocsPixiPreview
                  project={item.project}
                  play={play}
                  chrome="bare"
                />
                {overlay !== "none" ? (
                  <OverlayHud overlay={overlay} project={item.project} />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
      <div className="border-t border-[var(--border-subtle,#e4e4e7)] bg-[var(--code-block-bg)] px-4 py-3">
        <p className="mb-2 font-mono text-[11px] text-[var(--fg-muted)]">{path}</p>
        <pre className="overflow-x-auto text-[12.5px] leading-relaxed text-[var(--code-block-fg)]">
          <code>{JSON.stringify(selected.snippet, null, 2)}</code>
        </pre>
      </div>
    </section>
  );
}

type OverlayLayer = {
  translate: { x: number; y: number };
  origin: { x: number; y: number };
  scale: { x: number; y: number };
  rotateZ: number;
  frame: { width: number; height: number };
};

function OverlayHud({
  overlay,
  project,
}: {
  overlay: Exclude<DocsOverlayKind, "none">;
  project: unknown;
}) {
  const viewBox = useMemo(() => docsStageViewBox(project), [project]);
  const layer = useMemo(() => readOverlayLayer(project), [project]);
  if (!viewBox || !layer) return null;

  const { translate, origin, frame, rotateZ, scale } = layer;
  const w = frame.width * Math.abs(scale.x);
  const h = frame.height * Math.abs(scale.y);
  const localX = -origin.x * w;
  const localY = -origin.y * h;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <g
        transform={`translate(${translate.x} ${translate.y}) rotate(${rotateZ})`}
      >
        {overlay === "frame" || overlay === "origin" ? (
          <rect
            x={localX}
            y={localY}
            width={w}
            height={h}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="10 7"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {overlay === "origin" ? (
          <>
            <line
              x1={-28}
              y1={0}
              x2={28}
              y2={0}
              stroke="var(--accent)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={0}
              y1={-28}
              x2={0}
              y2={28}
              stroke="var(--accent)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              r={5}
              fill="var(--bg-elevated)"
              stroke="var(--accent)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}
      </g>
    </svg>
  );
}

function readOverlayLayer(project: unknown): OverlayLayer | null {
  if (!project || typeof project !== "object") return null;
  const layers = (project as { layers?: unknown }).layers;
  if (!Array.isArray(layers) || layers.length === 0) return null;
  const layer = layers[0];
  if (!layer || typeof layer !== "object") return null;
  const rec = layer as {
    frame?: { width?: unknown; height?: unknown };
    transform?: {
      translate?: { x?: unknown; y?: unknown };
      origin?: { x?: unknown; y?: unknown };
      scale?: { x?: unknown; y?: unknown };
      rotate?: { z?: unknown };
    };
  };
  const width = rec.frame?.width;
  const height = rec.frame?.height;
  const tx = rec.transform?.translate?.x;
  const ty = rec.transform?.translate?.y;
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    typeof tx !== "number" ||
    typeof ty !== "number"
  ) {
    return null;
  }
  const ox = rec.transform?.origin?.x;
  const oy = rec.transform?.origin?.y;
  const sx = rec.transform?.scale?.x;
  const sy = rec.transform?.scale?.y;
  const rot = rec.transform?.rotate?.z;
  return {
    frame: { width, height },
    translate: { x: tx, y: ty },
    origin: {
      x: typeof ox === "number" ? ox : 0.5,
      y: typeof oy === "number" ? oy : 0.5,
    },
    scale: {
      x: typeof sx === "number" ? sx : 1,
      y: typeof sy === "number" ? sy : 1,
    },
    rotateZ: typeof rot === "number" ? rot : 0,
  };
}
