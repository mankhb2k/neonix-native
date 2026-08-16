import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/**
 * Shape concept: the three formula primitives of V1 —
 * rectangle (with cornerRadius), ellipse, polygon (normalized points).
 */
export function ShapeFigure() {
  return (
    <Figure
      label='payload.shape — "rectangle" | "ellipse" | "polygon"'
      caption="Shape is a formula primitive. Color lives only in style.fill / style.stroke — never payload.color."
    >
      <svg
        viewBox="0 0 640 240"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Shape primitives"
      >
        {/* rectangle */}
        <g>
          <rect
            x={60}
            y={60}
            width={130}
            height={90}
            rx={16}
            fill="#ccfbf1"
            stroke={ACCENT}
            strokeWidth={2}
          />
          <text
            x={125}
            y={185}
            textAnchor="middle"
            fontSize={13}
            fill={INK}
            fontFamily="monospace"
          >
            rectangle
          </text>
          <text
            x={125}
            y={205}
            textAnchor="middle"
            fontSize={12}
            fill={MUTED}
            fontFamily="monospace"
          >
            cornerRadius 24
          </text>
        </g>

        {/* ellipse */}
        <g>
          <ellipse
            cx={305}
            cy={105}
            rx={70}
            ry={48}
            fill="#ccfbf1"
            stroke={ACCENT}
            strokeWidth={2}
          />
          <text
            x={305}
            y={185}
            textAnchor="middle"
            fontSize={13}
            fill={INK}
            fontFamily="monospace"
          >
            ellipse
          </text>
          <text
            x={305}
            y={205}
            textAnchor="middle"
            fontSize={12}
            fill={MUTED}
            fontFamily="monospace"
          >
            circle = square frame
          </text>
        </g>

        {/* polygon with normalized points */}
        <g>
          <polygon
            points="510,60 580,150 440,150"
            fill="#ccfbf1"
            stroke={ACCENT}
            strokeWidth={2}
          />
          <circle cx={510} cy={60} r={3.5} fill={INK} />
          <circle cx={580} cy={150} r={3.5} fill={INK} />
          <circle cx={440} cy={150} r={3.5} fill={INK} />
          <text
            x={510}
            y={50}
            textAnchor="middle"
            fontSize={11}
            fill={MUTED}
            fontFamily="monospace"
          >
            0.5, 0
          </text>
          <text
            x={588}
            y={164}
            fontSize={11}
            fill={MUTED}
            fontFamily="monospace"
          >
            1, 1
          </text>
          <text
            x={432}
            y={164}
            textAnchor="end"
            fontSize={11}
            fill={MUTED}
            fontFamily="monospace"
          >
            0, 1
          </text>
          <text
            x={510}
            y={185}
            textAnchor="middle"
            fontSize={13}
            fill={INK}
            fontFamily="monospace"
          >
            polygon
          </text>
          <text
            x={510}
            y={205}
            textAnchor="middle"
            fontSize={12}
            fill={MUTED}
            fontFamily="monospace"
          >
            points normalized 0..1
          </text>
        </g>
      </svg>
    </Figure>
  );
}
