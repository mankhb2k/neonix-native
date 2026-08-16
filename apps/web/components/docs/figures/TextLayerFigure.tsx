import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#111827";

/**
 * Text layer concept figure: one box, one run of text, one style.
 * Shows the frame box, the text run, and the "two styles = two layers" rule.
 */
export function TextLayerFigure() {
  return (
    <Figure
      label="payload of a text layer"
      caption="One box, one run of text, one shared style. Need two styles? Author two text layers."
    >
      <svg
        viewBox="0 0 640 260"
        className="w-full max-w-[560px]"
        role="img"
        aria-label="Text layer"
      >
        {/* one styled box */}
        <rect
          x={24}
          y={24}
          width={300}
          height={136}
          rx={8}
          fill="#fff"
          stroke={ACCENT}
          strokeWidth={2}
        />
        <text
          x={44}
          y={78}
          fontSize={34}
          fontWeight={600}
          fill={INK}
          fontFamily="system-ui"
        >
          Hello
        </text>
        {/* baseline + lineHeight hint */}
        <line
          x1={44}
          y1={86}
          x2={200}
          y2={86}
          stroke={MUTED}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <text x={44} y={110} fontSize={11} fill={INK} fontFamily="monospace">
          fontSize · color
        </text>
        <text x={44} y={126} fontSize={11} fill={INK} fontFamily="monospace">
          alignment · lineHeight
        </text>
        <text x={44} y={146} fontSize={11} fill={MUTED} fontFamily="monospace">
          one style for the whole box
        </text>

        {/* frame annotation */}
        <line
          x1={24}
          y1={176}
          x2={324}
          y2={176}
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <line
          x1={24}
          y1={171}
          x2={24}
          y2={181}
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <line
          x1={324}
          y1={171}
          x2={324}
          y2={181}
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <text
          x={174}
          y={194}
          textAnchor="middle"
          fontSize={14}
          fill={ACCENT}
          fontFamily="monospace"
        >
          frame.width
        </text>

        {/* two styles → two layers */}
        <g>
          <rect
            x={360}
            y={24}
            width={256}
            height={56}
            rx={8}
            fill="#fff"
            stroke={MUTED}
            strokeWidth={1.5}
          />
          <text x={378} y={60} fontSize={22} fontWeight={700} fill="#dc2626">
            Red
          </text>
          <rect
            x={360}
            y={92}
            width={256}
            height={56}
            rx={8}
            fill="#fff"
            stroke={MUTED}
            strokeWidth={1.5}
          />
          <text x={378} y={128} fontSize={22} fontWeight={700} fill="#2563eb">
            Blue
          </text>
          <text
            x={488}
            y={172}
            textAnchor="middle"
            fontSize={14}
            fill={MUTED}
            fontFamily="monospace"
          >
            two styles = two layers
          </text>
        </g>

        {/* no rich text note */}
        <text x={24} y={216} fontSize={14} fill={INK} fontFamily="monospace">
          No rich text, no runs, no per-word highlight in V1.
        </text>
      </svg>
    </Figure>
  );
}
