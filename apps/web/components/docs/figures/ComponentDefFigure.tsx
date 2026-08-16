import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/**
 * Definition vs instance: the sealed template lives in project.components[];
 * the project tree holds only type:"component" leaves that reference it.
 */
export function ComponentDefFigure() {
  return (
    <Figure
      label="components[] → layers[]"
      caption="The definition is a sealed template. The project tree holds only instance leaves — the compiler expands each instance into a wrapper plus internals."
    >
      <svg
        viewBox="0 0 640 260"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Definition vs instance"
      >
        <defs>
          <marker
            id="cd-a"
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

        {/* definition */}
        <rect
          x={40}
          y={30}
          width={230}
          height={200}
          rx={12}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />
        <text
          x={58}
          y={58}
          fontSize={13}
          fontWeight={600}
          fill={INK}
          fontFamily="monospace"
        >
          components[]
        </text>
        <text x={58} y={78} fontSize={11} fill={MUTED} fontFamily="monospace">
          sealed definition
        </text>
        <rect
          x={58}
          y={94}
          width={194}
          height={118}
          rx={8}
          fill="#f8fafc"
          stroke={MUTED}
          strokeWidth={1}
        />
        <text x={72} y={118} fontSize={11} fill={MUTED} fontFamily="monospace">
          internal layers
        </text>
        <text x={72} y={140} fontSize={11} fill={MUTED} fontFamily="monospace">
          propBindings
        </text>
        <text x={72} y={162} fontSize={11} fill={MUTED} fontFamily="monospace">
          variants (props presets)
        </text>
        <text x={72} y={190} fontSize={11} fill={MUTED} fontFamily="monospace">
          never on project tree
        </text>

        {/* arrow */}
        <line
          x1={284}
          y1={130}
          x2={346}
          y2={130}
          stroke={MUTED}
          strokeWidth={1.4}
          markerEnd="url(#cd-a)"
        />
        <text
          x={315}
          y={118}
          textAnchor="middle"
          fontSize={11}
          fill={MUTED}
          fontFamily="monospace"
        >
          componentId
        </text>

        {/* instance */}
        <rect
          x={360}
          y={30}
          width={240}
          height={200}
          rx={12}
          fill="#ccfbf1"
          fillOpacity={0.35}
          stroke={ACCENT}
          strokeWidth={2}
        />
        <text
          x={378}
          y={58}
          fontSize={13}
          fontWeight={600}
          fill={ACCENT}
          fontFamily="monospace"
        >
          layers[]
        </text>
        <rect
          x={378}
          y={76}
          width={204}
          height={64}
          rx={8}
          fill="#fff"
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <text
          x={392}
          y={102}
          fontSize={12}
          fontWeight={600}
          fill={INK}
          fontFamily="monospace"
        >
          cta · component
        </text>
        <text x={392} y={122} fontSize={11} fill={MUTED} fontFamily="monospace">
          wrapper atoms + props
        </text>
        <text x={378} y={170} fontSize={11} fill={MUTED} fontFamily="monospace">
          one leaf on the tree —
        </text>
        <text x={378} y={188} fontSize={11} fill={MUTED} fontFamily="monospace">
          compiler expands at build
        </text>
      </svg>
    </Figure>
  );
}
