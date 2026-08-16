import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

const BOX = { x: 24, size: 96, gapY: 96 };

function GlyphCell({
  x,
  y,
  label,
  children,
}: {
  x: number;
  y: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        x={0}
        y={0}
        width={BOX.size}
        height={72}
        rx={10}
        fill="#fff"
        stroke={MUTED}
        strokeWidth={1.5}
      />
      {children}
      <text
        x={BOX.size / 2}
        y={90}
        textAnchor="middle"
        fontSize={12}
        fill={INK}
        fontFamily="monospace"
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Type map glyphs: one tiny pictogram per layer type.
 */
export function TypeGlyphsFigure() {
  // 3 rows × 4 columns; cell width 136, row pitch 118
  const col = (i: number) => 40 + i * 144;
  const ROW = [16, 134, 252];
  return (
    <Figure
      label="layers[].type"
      caption="Eleven layer types at a glance. layout is not a type — it is packing behavior on a group."
    >
      <svg
        viewBox="0 0 640 370"
        className="w-full max-w-[640px]"
        role="img"
        aria-label="Layer type glyphs"
      >
        {/* row 1: group, text, shape, path */}
        <GlyphCell x={col(0)} y={ROW[0]} label="group">
          <rect
            x={18}
            y={14}
            width={60}
            height={44}
            rx={6}
            fill="#ccfbf1"
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <rect
            x={26}
            y={22}
            width={22}
            height={12}
            rx={3}
            fill="#fff"
            stroke={MUTED}
          />
          <rect
            x={52}
            y={38}
            width={22}
            height={12}
            rx={3}
            fill="#fff"
            stroke={MUTED}
          />
        </GlyphCell>
        <GlyphCell x={col(1)} y={ROW[0]} label="text">
          <text
            x={48}
            y={52}
            textAnchor="middle"
            fontSize={34}
            fontWeight={600}
            fill={INK}
          >
            A
          </text>
        </GlyphCell>
        <GlyphCell x={col(2)} y={ROW[0]} label="shape">
          <rect
            x={18}
            y={16}
            width={28}
            height={28}
            rx={5}
            fill="#ccfbf1"
            stroke={ACCENT}
            strokeWidth={1.5}
          />
          <circle
            cx={64}
            cy={40}
            r={16}
            fill="#ccfbf1"
            stroke={ACCENT}
            strokeWidth={1.5}
          />
        </GlyphCell>
        <GlyphCell x={col(3)} y={ROW[0]} label="path">
          <path
            d="M20 54 C 36 18, 60 18, 78 44"
            fill="none"
            stroke={ACCENT}
            strokeWidth={2}
          />
          <circle cx={20} cy={54} r={3.5} fill={INK} />
          <circle cx={78} cy={44} r={3.5} fill={INK} />
        </GlyphCell>
        {/* row 2: image, svg, video, audio */}
        <GlyphCell x={col(0)} y={ROW[1]} label="image">
          <rect
            x={18}
            y={14}
            width={60}
            height={44}
            rx={6}
            fill="#dbeafe"
            stroke={MUTED}
          />
          <circle cx={62} cy={26} r={6} fill="#fbbf24" />
          <path d="M18 58 L38 38 L52 50 L62 42 L78 58 Z" fill="#34d399" />
        </GlyphCell>
        <GlyphCell x={col(1)} y={ROW[1]} label="svg">
          <path
            d="M48 16 L74 56 L22 56 Z"
            fill="none"
            stroke={ACCENT}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </GlyphCell>
        <GlyphCell x={col(2)} y={ROW[1]} label="video">
          <rect x={18} y={16} width={60} height={40} rx={6} fill={INK} />
          <path d="M42 27 L60 36 L42 45 Z" fill="#fff" />
        </GlyphCell>
        <GlyphCell x={col(3)} y={ROW[1]} label="audio">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect
              key={i}
              x={26 + i * 8}
              y={36 - [10, 18, 26, 14, 22, 12, 8][i] / 2}
              width={4}
              height={[10, 18, 26, 14, 22, 12, 8][i]}
              rx={2}
              fill={ACCENT}
            />
          ))}
        </GlyphCell>
        {/* row 3: solid, adjustment, component */}
        <GlyphCell x={col(0)} y={ROW[2]} label="solid">
          <rect x={18} y={16} width={60} height={40} rx={6} fill={ACCENT} />
        </GlyphCell>
        <GlyphCell x={col(1)} y={ROW[2]} label="adjustment">
          <line
            x1={24}
            y1={28}
            x2={72}
            y2={28}
            stroke={MUTED}
            strokeWidth={2}
          />
          <line
            x1={24}
            y1={44}
            x2={72}
            y2={44}
            stroke={MUTED}
            strokeWidth={2}
          />
          <circle
            cx={40}
            cy={28}
            r={6}
            fill="#fff"
            stroke={ACCENT}
            strokeWidth={2}
          />
          <circle
            cx={58}
            cy={44}
            r={6}
            fill="#fff"
            stroke={ACCENT}
            strokeWidth={2}
          />
        </GlyphCell>
        <GlyphCell x={col(2)} y={ROW[2]} label="component">
          <rect
            x={18}
            y={16}
            width={60}
            height={40}
            rx={8}
            fill="#fff"
            stroke={ACCENT}
            strokeWidth={2}
          />
          <rect x={28} y={26} width={40} height={8} rx={4} fill="#e2e8f0" />
          <rect x={28} y={40} width={26} height={8} rx={4} fill="#e2e8f0" />
        </GlyphCell>
      </svg>
    </Figure>
  );
}
