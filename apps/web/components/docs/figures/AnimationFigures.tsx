import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/** Keyframes on a local layer window: t=0..duration, not the project clock. */
export function KeyframesFigure() {
  // opacity 0 → 100 over local t 0..2
  const x0 = 80;
  const x1 = 560;
  const y = 120;
  const keys = [
    { t: 0, v: 0 },
    { t: 1, v: 60 },
    { t: 2, v: 100 },
  ];
  const px = (t: number) => x0 + (t / 2) * (x1 - x0);
  return (
    <Figure
      label="timeline.clips — layer property keyframes"
      caption="Keyframes live on timeline.clips and use the target layer's local time: t=0 is layer.timing.start, t must stay within timing.duration."
    >
      <svg
        viewBox="0 0 640 220"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Keyframes"
      >
        {/* local window */}
        <rect
          x={x0}
          y={70}
          width={x1 - x0}
          height={60}
          rx={8}
          fill="#f8fafc"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text x={x0} y={56} fontSize={12} fill={MUTED} fontFamily="monospace">
          layer local window · timing.duration 2s
        </text>
        {/* ramp */}
        <path
          d={`M ${px(0)} ${y} L ${px(1)} ${y - 30} L ${px(2)} ${y - 50}`}
          fill="none"
          stroke={ACCENT}
          strokeWidth={2}
        />
        {keys.map((k) => (
          <g key={k.t}>
            <circle
              cx={px(k.t)}
              cy={y - (k.v / 100) * 50}
              r={6}
              fill="#fff"
              stroke={ACCENT}
              strokeWidth={2}
            />
            <text
              x={px(k.t)}
              y={y + 34}
              textAnchor="middle"
              fontSize={12}
              fill={INK}
              fontFamily="monospace"
            >
              t={k.t}
            </text>
            <text
              x={px(k.t)}
              y={y - (k.v / 100) * 50 - 14}
              textAnchor="middle"
              fontSize={11}
              fill={MUTED}
              fontFamily="monospace"
            >
              {k.v}
            </text>
          </g>
        ))}
        <text
          x={x0}
          y={y + 60}
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          appearance.opacity: 0 → 60 → 100
        </text>
        <text
          x={x1}
          y={y + 60}
          textAnchor="end"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          not the project clock
        </text>
      </svg>
    </Figure>
  );
}

/** Easing: linear vs easeIn vs easeOut vs easeInOut on the same 0→1 ramp. */
export function EasingFigure() {
  const curves = [
    { label: "linear", d: "M0 100 L100 0" },
    { label: "easeIn", d: "M0 100 C 60 100, 80 40, 100 0" },
    { label: "easeOut", d: "M0 100 C 20 60, 40 0, 100 0" },
    { label: "easeInOut", d: "M0 100 C 40 100, 60 0, 100 0" },
  ];
  return (
    <Figure
      label="keys[].easing"
      caption="Easing shapes the interpolation between two keys. Numbers tween; boolean, string, choice, and asset hold (step)."
    >
      <svg
        viewBox="0 0 640 190"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Easing"
      >
        {curves.map((c, i) => (
          <g key={c.label} transform={`translate(${30 + i * 155} 30)`}>
            <rect
              x={0}
              y={0}
              width={100}
              height={100}
              rx={8}
              fill="#f8fafc"
              stroke={MUTED}
              strokeWidth={1}
            />
            <path d={c.d} fill="none" stroke={ACCENT} strokeWidth={2.5} />
            <text
              x={50}
              y={126}
              textAnchor="middle"
              fontSize={13}
              fill={INK}
              fontFamily="monospace"
            >
              {c.label}
            </text>
          </g>
        ))}
      </svg>
    </Figure>
  );
}

/** Audio fade: volume envelope with fadeIn / fadeOut over the lane. */
export function AudioFadeFigure() {
  return (
    <Figure
      label="payload.fadeIn / fadeOut"
      caption="fadeIn and fadeOut shape the volume envelope across the layer window — separate from trim, which cuts the source."
    >
      <svg
        viewBox="0 0 640 200"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Audio fade"
      >
        {/* lane */}
        <rect
          x={60}
          y={60}
          width={520}
          height={80}
          rx={10}
          fill="#f8fafc"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        {/* volume envelope */}
        <path
          d="M60 140 L180 70 L460 70 L580 140 Z"
          fill="#ccfbf1"
          fillOpacity={0.5}
          stroke={ACCENT}
          strokeWidth={2}
        />
        <text
          x={120}
          y={160}
          textAnchor="middle"
          fontSize={12}
          fill={INK}
          fontFamily="monospace"
        >
          fadeIn
        </text>
        <text
          x={520}
          y={160}
          textAnchor="middle"
          fontSize={12}
          fill={INK}
          fontFamily="monospace"
        >
          fadeOut
        </text>
        <text
          x={320}
          y={104}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          full volume
        </text>
        <text x={60} y={52} fontSize={12} fill={MUTED} fontFamily="monospace">
          music · audio lane
        </text>
      </svg>
    </Figure>
  );
}
