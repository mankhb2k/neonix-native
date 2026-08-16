import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/**
 * Adjustment concept: a dedicated grade layer in the tree that sits above
 * the layers it grades — contrasted with effects color-adjust on one layer.
 */
export function AdjustmentFigure() {
  return (
    <Figure
      label='type: "adjustment"'
      caption="A grade layer of its own — frame, timing, zIndex like other visuals. It is not effects[].type color-adjust, which grades a single layer."
    >
      <svg
        viewBox="0 0 640 250"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Adjustment layer"
      >
        {/* stack: adjustment on top of visual lanes */}
        <g>
          <rect
            x={60}
            y={36}
            width={380}
            height={48}
            rx={8}
            fill="#ccfbf1"
            stroke={ACCENT}
            strokeWidth={2}
          />
          <text
            x={78}
            y={66}
            fontSize={13}
            fontWeight={600}
            fill={INK}
            fontFamily="monospace"
          >
            grade · adjustment
          </text>
          <text
            x={428}
            y={66}
            textAnchor="end"
            fontSize={12}
            fill={ACCENT}
            fontFamily="monospace"
          >
            zIndex 2
          </text>
        </g>
        <g>
          <rect
            x={60}
            y={96}
            width={380}
            height={44}
            rx={8}
            fill="#fff"
            stroke={MUTED}
            strokeWidth={1.5}
          />
          <text x={78} y={123} fontSize={13} fill={INK} fontFamily="monospace">
            title · text
          </text>
          <text
            x={428}
            y={123}
            textAnchor="end"
            fontSize={12}
            fill={MUTED}
            fontFamily="monospace"
          >
            zIndex 1
          </text>
        </g>
        <g>
          <rect
            x={60}
            y={152}
            width={380}
            height={44}
            rx={8}
            fill="#fff"
            stroke={MUTED}
            strokeWidth={1.5}
          />
          <text x={78} y={179} fontSize={13} fill={INK} fontFamily="monospace">
            photo · image
          </text>
          <text
            x={428}
            y={179}
            textAnchor="end"
            fontSize={12}
            fill={MUTED}
            fontFamily="monospace"
          >
            zIndex 0
          </text>
        </g>

        {/* grade arrows down */}
        <line
          x1={250}
          y1={84}
          x2={250}
          y2={94}
          stroke={ACCENT}
          strokeWidth={1.5}
          markerEnd="url(#adj-a)"
        />
        <line
          x1={250}
          y1={140}
          x2={250}
          y2={150}
          stroke={ACCENT}
          strokeWidth={1.5}
          markerEnd="url(#adj-a)"
        />
        <defs>
          <marker
            id="adj-a"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path
              d="M0 0 L8 4 L0 8"
              fill="none"
              stroke={ACCENT}
              strokeWidth={1.4}
            />
          </marker>
        </defs>

        {/* side note: vs effect */}
        <rect
          x={472}
          y={36}
          width={150}
          height={160}
          rx={10}
          fill="#f8fafc"
          stroke={MUTED}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text
          x={486}
          y={62}
          fontSize={12}
          fontWeight={600}
          fill={INK}
          fontFamily="monospace"
        >
          vs effect
        </text>
        <text x={486} y={86} fontSize={11} fill={MUTED} fontFamily="monospace">
          effects[]
        </text>
        <text x={486} y={102} fontSize={11} fill={MUTED} fontFamily="monospace">
          color-adjust
        </text>
        <text x={486} y={124} fontSize={11} fill={MUTED} fontFamily="monospace">
          grades ONE
        </text>
        <text x={486} y={140} fontSize={11} fill={MUTED} fontFamily="monospace">
          existing layer
        </text>

        {/* payload identity */}
        <text x={60} y={228} fontSize={12} fill={MUTED} fontFamily="monospace">
          payload: brightness 100 · contrast 110 · saturation 90 · hue-rotate 0
        </text>
      </svg>
    </Figure>
  );
}
