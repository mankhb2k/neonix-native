import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/**
 * Layout concept: a group packs children inside its frame with
 * mode/gap/padding. layoutItem on each child opts into the rule.
 * Compiler bakes the result into frame + translate.
 */
export function LayoutFigure() {
  return (
    <Figure
      label="group.layout — mode column, gap 16, padding 24"
      caption="Layout packs children inside the group frame. The compiler bakes the result into frame + translate and drops layout/layoutItem before runtime."
    >
      <svg
        viewBox="0 0 640 300"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Group layout packing"
      >
        {/* group frame with padding guide */}
        <rect
          x={120}
          y={24}
          width={280}
          height={252}
          rx={10}
          fill="#ccfbf1"
          fillOpacity={0.3}
          stroke={ACCENT}
          strokeWidth={2}
        />
        <rect
          x={140}
          y={44}
          width={240}
          height={212}
          rx={6}
          fill="none"
          stroke={MUTED}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <text
          x={140}
          y={18}
          fontSize={13}
          fontWeight={600}
          fill={ACCENT}
          fontFamily="monospace"
        >
          group · frame 800×400
        </text>

        {/* children packed in a column */}
        <rect
          x={140}
          y={44}
          width={240}
          height={52}
          rx={6}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text x={156} y={75} fontSize={13} fill={INK} fontFamily="monospace">
          title · width fill
        </text>

        <rect
          x={140}
          y={112}
          width={240}
          height={52}
          rx={6}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text x={156} y={143} fontSize={13} fill={INK} fontFamily="monospace">
          card · height hug
        </text>

        <rect
          x={140}
          y={180}
          width={240}
          height={52}
          rx={6}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text x={156} y={211} fontSize={13} fill={INK} fontFamily="monospace">
          cta · width fixed
        </text>

        {/* gap annotations */}
        <line
          x1={392}
          y1={96}
          x2={392}
          y2={112}
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <text
          x={400}
          y={107}
          fontSize={11}
          fill={ACCENT}
          fontFamily="monospace"
        >
          gap 16
        </text>
        <line
          x1={392}
          y1={164}
          x2={392}
          y2={180}
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <text
          x={400}
          y={175}
          fontSize={11}
          fill={ACCENT}
          fontFamily="monospace"
        >
          gap 16
        </text>

        {/* padding annotation */}
        <line
          x1={120}
          y1={288}
          x2={140}
          y2={288}
          stroke={MUTED}
          strokeWidth={1.2}
        />
        <line
          x1={400}
          y1={288}
          x2={380}
          y2={288}
          stroke={MUTED}
          strokeWidth={1.2}
        />
        <text
          x={260}
          y={292}
          textAnchor="middle"
          fontSize={11}
          fill={MUTED}
          fontFamily="monospace"
        >
          padding 24
        </text>

        {/* compiler note */}
        <text x={440} y={150} fontSize={12} fill={MUTED} fontFamily="monospace">
          compiler bakes to
        </text>
        <text x={440} y={168} fontSize={12} fill={MUTED} fontFamily="monospace">
          frame + translate
        </text>
      </svg>
    </Figure>
  );
}
