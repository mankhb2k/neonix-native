import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/**
 * Path concept: freeform vector built from contours and segments in local
 * pixel coordinates. A cubic segment shows its control handles; a second
 * contour makes a hole (letter-O style).
 */
export function PathFigure() {
  return (
    <Figure
      label="payload.contours[]"
      caption="Path is freeform vector: contours + segments in local frame pixels. Use it for icons, Bezier curves, and holes — use shape for standard primitives."
    >
      <svg
        viewBox="0 0 640 260"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Path contours and segments"
      >
        {/* bezier curve with handles */}
        <g>
          <path
            d="M60 190 C 140 60, 240 60, 320 150"
            fill="none"
            stroke={ACCENT}
            strokeWidth={2.5}
          />
          {/* control handles */}
          <line
            x1={60}
            y1={190}
            x2={140}
            y2={60}
            stroke={MUTED}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <line
            x1={320}
            y1={150}
            x2={240}
            y2={60}
            stroke={MUTED}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <circle cx={60} cy={190} r={4} fill={INK} />
          <circle cx={320} cy={150} r={4} fill={INK} />
          <circle
            cx={140}
            cy={60}
            r={4}
            fill="#fff"
            stroke={ACCENT}
            strokeWidth={1.5}
          />
          <circle
            cx={240}
            cy={60}
            r={4}
            fill="#fff"
            stroke={ACCENT}
            strokeWidth={1.5}
          />
          <text x={52} y={212} fontSize={12} fill={INK} fontFamily="monospace">
            start
          </text>
          <text
            x={128}
            y={46}
            fontSize={12}
            fill={MUTED}
            fontFamily="monospace"
          >
            control1
          </text>
          <text
            x={222}
            y={46}
            fontSize={12}
            fill={MUTED}
            fontFamily="monospace"
          >
            control2
          </text>
          <text x={300} y={172} fontSize={12} fill={INK} fontFamily="monospace">
            to
          </text>
          <text
            x={190}
            y={240}
            textAnchor="middle"
            fontSize={13}
            fill={INK}
            fontFamily="monospace"
          >
            cubic segment — local pixels
          </text>
        </g>

        {/* two contours = hole */}
        <g>
          <path
            d="M470 70 a55 55 0 1 0 0.01 0 Z M470 100 a25 25 0 1 1 -0.01 0 Z"
            fill="#ccfbf1"
            fillRule="evenodd"
            stroke={ACCENT}
            strokeWidth={2}
          />
          <text
            x={470}
            y={240}
            textAnchor="middle"
            fontSize={13}
            fill={INK}
            fontFamily="monospace"
          >
            two contours → a hole
          </text>
        </g>
      </svg>
    </Figure>
  );
}
