"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type TrendPoint = {
  /** Pre-formatted, locale-aware label (e.g. "Mar 3"). */
  label: string;
  value: number;
};

export type ExportsTrendChartProps = {
  data: TrendPoint[];
  title: string;
  description: string;
  valueLabel: string;
  dateLabel: string;
  showTableLabel: string;
  showChartLabel: string;
};

const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 220;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 28;
const PADDING_LEFT = 28;
const PADDING_RIGHT = 12;

function niceMax(max: number): number {
  const withHeadroom = Math.max(max, 1) * 1.25;
  const step = withHeadroom <= 10 ? 2 : 5;
  return Math.max(step, Math.ceil(withHeadroom / step) * step);
}

/**
 * Monotone cubic interpolation (Fritsch–Carlson, the same family as
 * d3.curveMonotoneX) — smooths the line without letting a curve segment
 * overshoot past either endpoint's neighbors, so the smoothed shape never
 * implies a value the data didn't have.
 */
function buildSmoothPath(pts: Array<{ x: number; y: number }>): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const deltaX = pts[i + 1].x - pts[i].x;
    const deltaY = pts[i + 1].y - pts[i].y;
    dx.push(deltaX);
    slope.push(deltaX === 0 ? 0 : deltaY / deltaX);
  }

  const tangent: number[] = new Array<number>(n).fill(0);
  tangent[0] = slope[0] ?? 0;
  tangent[n - 1] = slope[n - 2] ?? 0;
  for (let i = 1; i < n - 1; i++) {
    const noOvershoot = slope[i - 1] === 0 || slope[i] === 0 || slope[i - 1] < 0 !== slope[i] < 0;
    tangent[i] = noOvershoot ? 0 : (slope[i - 1] + slope[i]) / 2;
  }

  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const alpha = tangent[i] / slope[i];
    const beta = tangent[i + 1] / slope[i];
    const magnitude = Math.hypot(alpha, beta);
    if (magnitude > 3) {
      const scale = 3 / magnitude;
      tangent[i] = scale * alpha * slope[i];
      tangent[i + 1] = scale * beta * slope[i];
    }
  }

  let path = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const third = dx[i] / 3;
    const c1x = pts[i].x + third;
    const c1y = pts[i].y + tangent[i] * third;
    const c2x = pts[i + 1].x - third;
    const c2y = pts[i + 1].y - tangent[i + 1] * third;
    path += ` C${c1x},${c1y} ${c2x},${c2y} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return path;
}

export function ExportsTrendChart({
  data,
  title,
  description,
  valueLabel,
  dateLabel,
  showTableLabel,
  showChartLabel,
}: ExportsTrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const plotWidth = VIEW_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const baselineY = PADDING_TOP + plotHeight;
  const maxValue = Math.max(...data.map((point) => point.value), 0);
  const yMax = niceMax(maxValue);
  const yTicks = [0, yMax / 2, yMax];

  const xStep = data.length > 1 ? plotWidth / (data.length - 1) : 0;
  const xFor = (index: number) => PADDING_LEFT + index * xStep;
  const yFor = (value: number) => PADDING_TOP + plotHeight - (value / yMax) * plotHeight;

  const points = useMemo(
    () => data.map((point, index) => ({ x: xFor(index), y: yFor(point.value), ...point })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, plotWidth, plotHeight, yMax],
  );

  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L${points[points.length - 1]?.x ?? 0},${baselineY} L${points[0]?.x ?? 0},${baselineY} Z`;

  const lastPoint = points[points.length - 1];

  function updateHoverFromClientX(clientX: number) {
    const svg = svgRef.current;
    if (!svg || data.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const scale = VIEW_WIDTH / rect.width;
    const localX = (clientX - rect.left) * scale;
    const rawIndex = xStep > 0 ? Math.round((localX - PADDING_LEFT) / xStep) : 0;
    setHoverIndex(Math.min(data.length - 1, Math.max(0, rawIndex)));
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    updateHoverFromClientX(event.clientX);
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setHoverIndex((current) => Math.min(data.length - 1, (current ?? -1) + 1));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setHoverIndex((current) => Math.max(0, (current ?? data.length) - 1));
    }
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const tooltipLeftPercent = hovered ? (hovered.x / VIEW_WIDTH) * 100 : 0;
  const tooltipAlignEnd = tooltipLeftPercent > 70;

  return (
    <section className="rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-body font-semibold text-[var(--fg-primary)]">{title}</h2>
          <p className="mt-1 text-caption text-[var(--fg-muted)]">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((current) => !current)}
          className="shrink-0 rounded-md border border-[var(--hub-border)] px-2.5 py-1.5 text-caption font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--hub-hover)] hover:text-[var(--fg-primary)]"
        >
          {showTable ? showChartLabel : showTableLabel}
        </button>
      </div>

      {showTable ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-body">
            <thead>
              <tr className="border-b border-[var(--hub-border)] text-left text-caption uppercase tracking-[0.06em] text-[var(--fg-muted)]">
                <th className="py-2 pr-4 font-semibold">{dateLabel}</th>
                <th className="py-2 font-semibold">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.label} className="border-b border-[var(--hub-divider)] last:border-0">
                  <td className="py-2 pr-4 text-[var(--fg-secondary)]">{point.label}</td>
                  <td className="py-2 font-mono text-[var(--fg-primary)]">{point.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-2">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="w-full touch-none"
            role="img"
            aria-label={`${title}. ${description}`}
            tabIndex={0}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
            onKeyDown={handleKeyDown}
            onBlur={() => setHoverIndex(null)}
          >
            {yTicks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PADDING_LEFT}
                  x2={VIEW_WIDTH - PADDING_RIGHT}
                  y1={yFor(tick)}
                  y2={yFor(tick)}
                  stroke="var(--hub-divider)"
                  strokeWidth={1}
                />
                <text x={PADDING_LEFT - 6} y={yFor(tick)} textAnchor="end" dominantBaseline="middle" className="fill-[var(--fg-disabled)] text-[8px]">
                  {Math.round(tick)}
                </text>
              </g>
            ))}

            {points.map((point, index) => {
              const isFirst = index === 0;
              const isLast = index === points.length - 1;
              // Skip the point right before the last one: it's always within
              // one step of the forced-visible last label, and longer date
              // strings (e.g. "28 thg 9") would collide with it otherwise.
              const isAdjacentToLast = index === points.length - 2;
              const shouldShow = isFirst || isLast || (!isAdjacentToLast && index % 3 === 0);
              if (!shouldShow) return null;
              // Anchor the first/last tick inward so long date strings never
              // overflow the viewBox edge and get clipped.
              const textAnchor = isFirst ? "start" : isLast ? "end" : "middle";
              return (
                <text
                  key={point.label}
                  x={point.x}
                  y={VIEW_HEIGHT - 8}
                  textAnchor={textAnchor}
                  className="fill-[var(--fg-disabled)] text-[8px]"
                >
                  {point.label}
                </text>
              );
            })}

            <path d={areaPath} fill="color-mix(in srgb, var(--accent) 10%, transparent)" stroke="none" />
            <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {lastPoint ? (
              <>
                <circle cx={lastPoint.x} cy={lastPoint.y} r={5} fill="var(--accent)" stroke="var(--hub-card-bg)" strokeWidth={2} />
                <text x={lastPoint.x} y={lastPoint.y - 10} textAnchor="end" className="fill-[var(--fg-primary)] text-[9px] font-semibold">
                  {lastPoint.value}
                </text>
              </>
            ) : null}

            {hovered ? (
              <>
                <line
                  x1={hovered.x}
                  x2={hovered.x}
                  y1={PADDING_TOP}
                  y2={baselineY}
                  stroke="var(--fg-disabled)"
                  strokeWidth={1}
                />
                <circle cx={hovered.x} cy={hovered.y} r={5} fill="var(--accent)" stroke="var(--hub-card-bg)" strokeWidth={2} />
              </>
            ) : null}
          </svg>

          {hovered ? (
            <div
              role="status"
              className={`pointer-events-none absolute top-1 flex min-w-max flex-col rounded-md border border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-2.5 py-1.5 text-caption shadow-[0_8px_24px_rgba(15,23,42,0.16)] ${tooltipAlignEnd ? "-translate-x-full items-end" : "items-start"}`}
              style={{ left: `${tooltipLeftPercent}%` }}
            >
              <span className="text-[var(--fg-muted)]">{hovered.label}</span>
              <span className="font-mono font-semibold text-[var(--fg-primary)]">
                {hovered.value} {valueLabel}
              </span>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
