import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/**
 * Group concept: a container that moves/transforms its subtree as one unit.
 * Its frame is its own box and does NOT clip children — a child may stick out.
 */
export function GroupFigure() {
  return (
    <Figure
      label='type: "group"'
      caption="A group treats children as one unit: transform, opacity, and timing apply to the whole subtree. Its frame is its own size box — it does not clip children."
    >
      <svg
        viewBox="0 0 640 280"
        className="w-full max-w-[560px]"
        role="img"
        aria-label="Group"
      >
        {/* group frame (dashed, not a clip) */}
        <rect
          x={90}
          y={40}
          width={300}
          height={180}
          rx={10}
          fill="#ccfbf1"
          fillOpacity={0.35}
          stroke={ACCENT}
          strokeWidth={2}
          strokeDasharray="8 5"
        />
        <text
          x={108}
          y={62}
          fontSize={14}
          fontWeight={600}
          fill={ACCENT}
          fontFamily="monospace"
        >
          hero · group · frame 520×200
        </text>

        {/* children */}
        <rect
          x={120}
          y={80}
          width={220}
          height={60}
          rx={8}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text x={136} y={115} fontSize={14} fill={INK} fontFamily="monospace">
          card · solid
        </text>

        <rect
          x={150}
          y={150}
          width={180}
          height={48}
          rx={8}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text x={166} y={179} fontSize={14} fill={INK} fontFamily="monospace">
          title · text
        </text>

        {/* child sticking out below-right — proves no clip, clears siblings */}
        <rect
          x={352}
          y={216}
          width={130}
          height={56}
          rx={8}
          fill="#fff"
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <text x={366} y={240} fontSize={13} fill={INK} fontFamily="monospace">
          badge
        </text>
        <text x={366} y={258} fontSize={12} fill={MUTED} fontFamily="monospace">
          not clipped
        </text>

        {/* transform arrow: whole subtree moves together */}
        <line
          x1={480}
          y1={130}
          x2={580}
          y2={130}
          stroke={MUTED}
          strokeWidth={1.5}
          markerEnd="url(#gr-arrow)"
        />
        <defs>
          <marker
            id="gr-arrow"
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
              strokeWidth="1.4"
            />
          </marker>
        </defs>
        <text
          x={530}
          y={112}
          textAnchor="middle"
          fontSize={14}
          fill={MUTED}
          fontFamily="monospace"
        >
          transform applies
        </text>
        <text
          x={530}
          y={152}
          textAnchor="middle"
          fontSize={14}
          fill={MUTED}
          fontFamily="monospace"
        >
          to the whole subtree
        </text>
      </svg>
    </Figure>
  );
}
