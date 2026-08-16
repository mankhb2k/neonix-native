import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/**
 * Transform pipeline: frame → origin → scale/rotate/skew → translate/depth.
 * Same object on every visual layer; audio has none.
 */
export function TransformPipelineFigure() {
  const steps = [
    { label: "frame", sub: "local box" },
    { label: "origin", sub: "pivot" },
    { label: "scale · rotate · skew", sub: "around origin" },
    { label: "translate · depth", sub: "into parent space" },
  ];
  return (
    <Figure
      label="transform pipeline"
      caption="One transform object on every visual layer. Steps apply in order — layout computes placement first, transform applies last. Audio has no transform."
    >
      <svg
        viewBox="0 0 640 200"
        className="w-full max-w-[640px]"
        role="img"
        aria-label="Transform pipeline"
      >
        <defs>
          <marker
            id="tp-a"
            markerWidth="9"
            markerHeight="9"
            refX="7"
            refY="4.5"
            orient="auto"
          >
            <path
              d="M0 0 L9 4.5 L0 9"
              fill="none"
              stroke={MUTED}
              strokeWidth={1.4}
            />
          </marker>
        </defs>
        {steps.map((s, i) => {
          const w = i === 2 ? 176 : 130;
          const x = [24, 172, 320, 514][i];
          const cx = x + (i === 2 ? 88 : 0);
          return (
            <g key={s.label}>
              <rect
                x={i === 2 ? x - 26 : x}
                y={60}
                width={w}
                height={64}
                rx={10}
                fill={i === 0 ? "#fff" : "#ccfbf1"}
                fillOpacity={i === 0 ? 1 : 0.4}
                stroke={i === 0 ? MUTED : ACCENT}
                strokeWidth={1.5}
                strokeDasharray={i === 0 ? "5 4" : undefined}
              />
              <text
                x={i === 2 ? cx - 26 + w / 2 : x + w / 2}
                y={86}
                textAnchor="middle"
                fontSize={13}
                fontWeight={600}
                fill={INK}
                fontFamily="monospace"
              >
                {s.label}
              </text>
              <text
                x={i === 2 ? cx - 26 + w / 2 : x + w / 2}
                y={106}
                textAnchor="middle"
                fontSize={11}
                fill={MUTED}
                fontFamily="monospace"
              >
                {s.sub}
              </text>
              {i < steps.length - 1 ? (
                <line
                  x1={(i === 2 ? x - 26 : x) + w + 6}
                  y1={92}
                  x2={(i === 2 ? x - 26 : x) + w + 22}
                  y2={92}
                  stroke={MUTED}
                  strokeWidth={1.4}
                  markerEnd="url(#tp-a)"
                />
              ) : null}
            </g>
          );
        })}
        <text x={24} y={170} fontSize={12} fill={MUTED} fontFamily="monospace">
          same object on group · component · text · image · svg · video · shape
          · path · solid · adjustment
        </text>
      </svg>
    </Figure>
  );
}
