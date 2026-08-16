import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/** Variants: same definition, different prop presets — tree never changes. */
export function ComponentVariantsFigure() {
  const variants = [
    { label: "default", color: "#94a3b8", chip: "color #64748b" },
    { label: "primary", color: "#1877f2", chip: "color #1877f2" },
    { label: "danger", color: "#dc2626", chip: "color #dc2626" },
  ];
  return (
    <Figure
      label="components[].variants"
      caption="A variant is a named props preset. It never replaces the internal tree, propBindings, or layout graph — pick it with payload.variantId."
    >
      <svg
        viewBox="0 0 640 210"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Variants"
      >
        {variants.map((v, i) => (
          <g key={v.label} transform={`translate(${60 + i * 190} 36)`}>
            {/* same button shape */}
            <rect x={0} y={0} width={140} height={48} rx={10} fill={v.color} />
            <text
              x={70}
              y={29}
              textAnchor="middle"
              fontSize={13}
              fontWeight={600}
              fill="#fff"
              fontFamily="monospace"
            >
              Shop now
            </text>
            <text
              x={70}
              y={76}
              textAnchor="middle"
              fontSize={12}
              fontWeight={600}
              fill={INK}
              fontFamily="monospace"
            >
              {v.label}
            </text>
            <text
              x={70}
              y={94}
              textAnchor="middle"
              fontSize={11}
              fill={MUTED}
              fontFamily="monospace"
            >
              {v.chip}
            </text>
          </g>
        ))}
        <text
          x={320}
          y={170}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          same internals — only props change
        </text>
      </svg>
    </Figure>
  );
}

/** Project bindings: a variable wired one-way into a public prop. */
export function ComponentBindingsFigure() {
  return (
    <Figure
      label="project.bindings"
      caption="A project binding is one-way: from a project variable to a public prop on the instance. The only target type is prop."
    >
      <svg
        viewBox="0 0 640 210"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Project bindings"
      >
        <defs>
          <marker
            id="cb-a"
            markerWidth="9"
            markerHeight="9"
            refX="7"
            refY="4.5"
            orient="auto"
          >
            <path
              d="M0 0 L9 4.5 L0 9"
              fill="none"
              stroke={ACCENT}
              strokeWidth={1.5}
            />
          </marker>
        </defs>

        {/* variable */}
        <rect
          x={50}
          y={70}
          width={180}
          height={60}
          rx={10}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text x={68} y={96} fontSize={12} fill={MUTED} fontFamily="monospace">
          variables[]
        </text>
        <text
          x={68}
          y={116}
          fontSize={13}
          fontWeight={600}
          fill={INK}
          fontFamily="monospace"
        >
          cta-text: string
        </text>

        {/* one-way arrow */}
        <line
          x1={238}
          y1={100}
          x2={356}
          y2={100}
          stroke={ACCENT}
          strokeWidth={1.5}
          markerEnd="url(#cb-a)"
        />
        <text
          x={297}
          y={88}
          textAnchor="middle"
          fontSize={11}
          fill={ACCENT}
          fontFamily="monospace"
        >
          one-way
        </text>

        {/* instance prop */}
        <rect
          x={366}
          y={60}
          width={226}
          height={80}
          rx={10}
          fill="#ccfbf1"
          fillOpacity={0.4}
          stroke={ACCENT}
          strokeWidth={2}
        />
        <text x={384} y={88} fontSize={12} fill={MUTED} fontFamily="monospace">
          cta · component
        </text>
        <text
          x={384}
          y={110}
          fontSize={13}
          fontWeight={600}
          fill={INK}
          fontFamily="monospace"
        >
          props.label
        </text>

        {/* forbidden path */}
        <text
          x={320}
          y={176}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          never binds to a layer property path — only to a prop
        </text>
      </svg>
    </Figure>
  );
}

/** Nested components: childProp forwards one level at a time. */
export function ComponentNestedFigure() {
  return (
    <Figure
      label="propBindings — childProp"
      caption="Nested instances receive values only through childProp, one level at a time. There is no skip-level binding into a grandchild."
    >
      <svg
        viewBox="0 0 640 230"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Nested components"
      >
        <defs>
          <marker
            id="cn-a"
            markerWidth="9"
            markerHeight="9"
            refX="7"
            refY="4.5"
            orient="auto"
          >
            <path
              d="M0 0 L9 4.5 L0 9"
              fill="none"
              stroke={ACCENT}
              strokeWidth={1.5}
            />
          </marker>
        </defs>

        {/* parent */}
        <rect
          x={60}
          y={30}
          width={240}
          height={170}
          rx={12}
          fill="#ccfbf1"
          fillOpacity={0.35}
          stroke={ACCENT}
          strokeWidth={2}
        />
        <text
          x={78}
          y={58}
          fontSize={13}
          fontWeight={600}
          fill={ACCENT}
          fontFamily="monospace"
        >
          parent · component
        </text>

        {/* child inside parent */}
        <rect
          x={88}
          y={76}
          width={184}
          height={104}
          rx={10}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text
          x={104}
          y={102}
          fontSize={12}
          fontWeight={600}
          fill={INK}
          fontFamily="monospace"
        >
          child · component
        </text>
        <text x={104} y={124} fontSize={11} fill={MUTED} fontFamily="monospace">
          own propBindings
        </text>
        <text x={104} y={142} fontSize={11} fill={MUTED} fontFamily="monospace">
          fan out inside
        </text>

        {/* childProp arrow */}
        <path
          d="M180 30 C 180 8, 360 8, 380 40"
          fill="none"
          stroke={ACCENT}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          markerEnd="url(#cn-a)"
        />
        <text x={330} y={20} fontSize={11} fill={ACCENT} fontFamily="monospace">
          childProp
        </text>

        {/* blocked skip-level */}
        <g>
          <line
            x1={420}
            y1={200}
            x2={180}
            y2={128}
            stroke={MUTED}
            strokeWidth={1.2}
            strokeDasharray="4 4"
          />
          <line
            x1={318}
            y1={140}
            x2={330}
            y2={166}
            stroke="#dc2626"
            strokeWidth={2}
          />
          <line
            x1={330}
            y1={140}
            x2={318}
            y2={166}
            stroke="#dc2626"
            strokeWidth={2}
          />
          <text
            x={420}
            y={216}
            fontSize={11}
            fill={MUTED}
            fontFamily="monospace"
          >
            no skip-level into nested internals
          </text>
        </g>
      </svg>
    </Figure>
  );
}
