import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/**
 * "What is a layer" concept figure: one layer card with its field groups
 * annotated, sitting on a timeline lane.
 */
export function LayerAnatomyFigure() {
  return (
    <Figure
      label="layers[]"
      caption="A visual layer answers five questions: what it is, where it sits, when it lives, how it looks, and who its parent is."
    >
      <svg
        viewBox="0 0 640 300"
        className="w-full max-w-[560px]"
        role="img"
        aria-label="Layer anatomy"
      >
        {/* canvas */}
        <rect
          x={16}
          y={16}
          width={608}
          height={220}
          rx={10}
          fill="#fff"
          stroke={MUTED}
          strokeDasharray="6 5"
        />
        <text x={32} y={40} fontSize={14} fill={MUTED} fontFamily="monospace">
          composition
        </text>

        {/* layer box */}
        <g>
          <rect
            x={180}
            y={70}
            width={280}
            height={120}
            rx={8}
            fill="#ccfbf1"
            stroke={ACCENT}
            strokeWidth={2}
          />
          <text
            x={320}
            y={120}
            textAnchor="middle"
            fontSize={14}
            fontWeight={600}
            fill={INK}
          >
            layer
          </text>
          <text
            x={320}
            y={142}
            textAnchor="middle"
            fontSize={14}
            fill={INK}
            opacity={0.7}
          >
            type · payload
          </text>
        </g>

        {/* frame annotation */}
        <line
          x1={180}
          y1={205}
          x2={460}
          y2={205}
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <line
          x1={180}
          y1={200}
          x2={180}
          y2={210}
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <line
          x1={460}
          y1={200}
          x2={460}
          y2={210}
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <text
          x={320}
          y={222}
          textAnchor="middle"
          fontSize={14}
          fill={ACCENT}
          fontFamily="monospace"
        >
          frame · transform · appearance
        </text>

        {/* callouts */}
        <text x={60} y={80} fontSize={14} fill={INK} fontFamily="monospace">
          id
        </text>
        <text x={60} y={98} fontSize={14} fill={INK} fontFamily="monospace">
          zIndex
        </text>
        <line
          x1={100}
          y1={88}
          x2={176}
          y2={100}
          stroke={MUTED}
          strokeWidth={1}
        />

        <text x={480} y={80} fontSize={14} fill={INK} fontFamily="monospace">
          parentLayerId
        </text>
        <line
          x1={478}
          y1={92}
          x2={464}
          y2={100}
          stroke={MUTED}
          strokeWidth={1}
        />

        {/* timeline lane */}
        <rect
          x={16}
          y={252}
          width={608}
          height={34}
          rx={6}
          fill="#f1f5f9"
          stroke={MUTED}
          strokeDasharray="6 5"
        />
        <rect
          x={180}
          y={258}
          width={280}
          height={22}
          rx={5}
          fill={ACCENT}
          opacity={0.85}
        />
        <text
          x={320}
          y={273}
          textAnchor="middle"
          fontSize={14}
          fill="#fff"
          fontFamily="monospace"
        >
          timing: start · duration
        </text>
        <text x={32} y={273} fontSize={14} fill={MUTED} fontFamily="monospace">
          0s
        </text>
      </svg>
    </Figure>
  );
}
