import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/**
 * Component concept: a sealed instance leaf. Outside you touch wrapper
 * atoms and public props; internals and propBindings stay sealed.
 * One prop can fan out to several inner layers.
 */
export function ComponentFigure() {
  return (
    <Figure
      label='type: "component"'
      caption="Wrapper atoms control the shell; payload.props are the public knobs; internals stay sealed. The compiler expands the instance into wrapper + internals."
    >
      <svg
        viewBox="0 0 640 290"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Component instance"
      >
        {/* wrapper */}
        <rect
          x={40}
          y={28}
          width={300}
          height={234}
          rx={12}
          fill="#ccfbf1"
          fillOpacity={0.3}
          stroke={ACCENT}
          strokeWidth={2}
        />
        <text
          x={58}
          y={54}
          fontSize={13}
          fontWeight={600}
          fill={ACCENT}
          fontFamily="monospace"
        >
          wrapper atoms
        </text>
        <text x={58} y={74} fontSize={11} fill={MUTED} fontFamily="monospace">
          frame · transform · timing · appearance
        </text>

        {/* sealed internals */}
        <rect
          x={66}
          y={92}
          width={248}
          height={120}
          rx={8}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />
        <text x={82} y={116} fontSize={12} fill={MUTED} fontFamily="monospace">
          sealed internals
        </text>
        <circle
          cx={116}
          cy={160}
          r={20}
          fill="none"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <rect x={156} y={146} width={120} height={12} rx={6} fill="#e2e8f0" />
        <rect x={156} y={168} width={88} height={12} rx={6} fill="#e2e8f0" />

        {/* props knob */}
        <rect x={66} y={224} width={248} height={28} rx={6} fill={ACCENT} />
        <text
          x={190}
          y={243}
          textAnchor="middle"
          fontSize={12}
          fill="#fff"
          fontFamily="monospace"
        >
          payload.props · brandColor
        </text>

        {/* fan-out wires */}
        <path
          d="M314 238 C 400 238, 380 160, 340 150"
          fill="none"
          stroke={ACCENT}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          markerEnd="url(#cp-a)"
        />
        <path
          d="M314 238 C 420 238, 420 100, 352 100"
          fill="none"
          stroke={ACCENT}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          markerEnd="url(#cp-a)"
        />
        <defs>
          <marker
            id="cp-a"
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

        {/* fan-out explanation */}
        <text x={420} y={150} fontSize={12} fill={INK} fontFamily="monospace">
          one prop
        </text>
        <text x={420} y={168} fontSize={12} fill={INK} fontFamily="monospace">
          fans out to
        </text>
        <text x={420} y={186} fontSize={12} fill={INK} fontFamily="monospace">
          many internals
        </text>
        <text x={420} y={212} fontSize={11} fill={MUTED} fontFamily="monospace">
          via propBindings
        </text>
        <text x={420} y={230} fontSize={11} fill={MUTED} fontFamily="monospace">
          (owner-side)
        </text>
      </svg>
    </Figure>
  );
}
