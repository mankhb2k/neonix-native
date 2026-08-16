import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/**
 * Root lanes and zIndex: visual roots stack 0,1,2 upward; audio sits below
 * with negative zIndex. A group subtree stays inside its root slot.
 */
export function ZIndexLanesFigure() {
  return (
    <Figure
      label="layers[].zIndex"
      caption="Root zIndex orders lanes. Audio uses negative values. A group subtree paints inside its root slot — a nested zIndex: 99 cannot jump above the next root lane."
    >
      <svg
        viewBox="0 0 640 280"
        className="w-full max-w-[560px]"
        role="img"
        aria-label="Root lanes and zIndex"
      >
        {/* paint direction */}
        <text
          x={600}
          y={30}
          textAnchor="end"
          fontSize={14}
          fill={MUTED}
          fontFamily="monospace"
        >
          paint order ↑
        </text>
        <line
          x1={608}
          y1={70}
          x2={608}
          y2={40}
          stroke={MUTED}
          strokeWidth={1.2}
          markerEnd="url(#zi-arrow)"
        />
        <defs>
          <marker
            id="zi-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path
              d="M0 0 L8 4 L0 8"
              fill="none"
              stroke={MUTED}
              strokeWidth="1.2"
            />
          </marker>
        </defs>

        {/* lanes from top (paints last) to bottom (paints first) */}
        {/* zIndex 2 */}
        <g>
          <rect
            x={120}
            y={48}
            width={440}
            height={44}
            rx={8}
            fill="#fff"
            stroke={MUTED}
            strokeWidth={1.5}
          />
          <text x={140} y={75} fontSize={14} fill={INK} fontFamily="monospace">
            title · text
          </text>
          <text
            x={548}
            y={75}
            textAnchor="end"
            fontSize={14}
            fontWeight={700}
            fill={ACCENT}
            fontFamily="monospace"
          >
            zIndex 2
          </text>
        </g>
        {/* zIndex 1: group with subtree */}
        <g>
          <rect
            x={120}
            y={100}
            width={440}
            height={64}
            rx={8}
            fill="#ccfbf1"
            stroke={ACCENT}
            strokeWidth={2}
          />
          <text
            x={140}
            y={125}
            fontSize={14}
            fontWeight={600}
            fill={INK}
            fontFamily="monospace"
          >
            hero · group
          </text>
          <text
            x={548}
            y={122}
            textAnchor="end"
            fontSize={14}
            fontWeight={700}
            fill={ACCENT}
            fontFamily="monospace"
          >
            zIndex 1
          </text>
          {/* subtree chips */}
          <rect
            x={240}
            y={132}
            width={140}
            height={24}
            rx={6}
            fill="#fff"
            stroke={MUTED}
            strokeWidth={1}
          />
          <text x={250} y={148} fontSize={14} fill={INK} fontFamily="monospace">
            card · zIndex 0
          </text>
          <rect
            x={390}
            y={132}
            width={150}
            height={24}
            rx={6}
            fill="#fff"
            stroke={MUTED}
            strokeWidth={1}
          />
          <text x={400} y={148} fontSize={14} fill={INK} fontFamily="monospace">
            badge · zIndex 99
          </text>
        </g>
        {/* zIndex 0 */}
        <g>
          <rect
            x={120}
            y={172}
            width={440}
            height={44}
            rx={8}
            fill="#fff"
            stroke={MUTED}
            strokeWidth={1.5}
          />
          <text x={140} y={199} fontSize={14} fill={INK} fontFamily="monospace">
            bg · solid
          </text>
          <text
            x={548}
            y={199}
            textAnchor="end"
            fontSize={14}
            fontWeight={700}
            fill={ACCENT}
            fontFamily="monospace"
          >
            zIndex 0
          </text>
        </g>
        {/* audio lane */}
        <g>
          <rect
            x={120}
            y={224}
            width={440}
            height={40}
            rx={8}
            fill="#f1f5f9"
            stroke={MUTED}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <text
            x={140}
            y={249}
            fontSize={14}
            fill={MUTED}
            fontFamily="monospace"
          >
            music · audio
          </text>
          <text
            x={548}
            y={249}
            textAnchor="end"
            fontSize={14}
            fontWeight={700}
            fill={MUTED}
            fontFamily="monospace"
          >
            zIndex -1
          </text>
        </g>

        {/* note: nested 99 cannot escape */}
        <text x={120} y={30} fontSize={14} fill={MUTED} fontFamily="monospace">
          nested zIndex orders siblings only
        </text>
      </svg>
    </Figure>
  );
}
