import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/**
 * Layer tree concept: roots on project.layers, only group has children,
 * child.parentLayerId points at the group. Audio is a root that cannot nest.
 */
export function LayerTreeFigure() {
  return (
    <Figure
      label="project.layers[]"
      caption="Roots live on project.layers. Only a group may have children — each child points back with parentLayerId. Audio is a root that can never nest."
    >
      <svg
        viewBox="0 0 640 300"
        className="w-full max-w-[560px]"
        role="img"
        aria-label="Layer tree"
      >
        <defs>
          <marker
            id="lt-arrow"
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

        {/* root lane: bg */}
        <rect
          x={24}
          y={32}
          width={200}
          height={40}
          rx={8}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text x={40} y={57} fontSize={14} fill={INK} fontFamily="monospace">
          bg · solid
        </text>

        {/* root lane: hero group */}
        <rect
          x={24}
          y={92}
          width={200}
          height={40}
          rx={8}
          fill="#ccfbf1"
          stroke={ACCENT}
          strokeWidth={2}
        />
        <text
          x={40}
          y={117}
          fontSize={14}
          fontWeight={600}
          fill={INK}
          fontFamily="monospace"
        >
          hero · group
        </text>

        {/* children of hero */}
        <line
          x1={224}
          y1={112}
          x2={268}
          y2={112}
          stroke={MUTED}
          strokeWidth={1.2}
        />
        <line
          x1={268}
          y1={112}
          x2={268}
          y2={156}
          stroke={MUTED}
          strokeWidth={1.2}
        />
        <line
          x1={268}
          y1={156}
          x2={268}
          y2={212}
          stroke={MUTED}
          strokeWidth={1.2}
        />
        <line
          x1={268}
          y1={156}
          x2={300}
          y2={156}
          stroke={MUTED}
          strokeWidth={1.2}
        />
        <line
          x1={268}
          y1={212}
          x2={300}
          y2={212}
          stroke={MUTED}
          strokeWidth={1.2}
        />

        <rect
          x={300}
          y={136}
          width={220}
          height={40}
          rx={8}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text x={316} y={161} fontSize={14} fill={INK} fontFamily="monospace">
          card · solid
        </text>

        <rect
          x={300}
          y={192}
          width={220}
          height={40}
          rx={8}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text x={316} y={217} fontSize={14} fill={INK} fontFamily="monospace">
          title · text
        </text>

        {/* parentLayerId back-pointer */}
        <path
          d="M520 196 C 590 196, 590 112, 532 112"
          fill="none"
          stroke={ACCENT}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          markerEnd="url(#lt-arrow)"
        />
        <text
          x={540}
          y={100}
          fontSize={13}
          fill={ACCENT}
          fontFamily="monospace"
        >
          parentLayerId
        </text>

        {/* root lane: audio (cannot nest) */}
        <rect
          x={24}
          y={244}
          width={200}
          height={40}
          rx={8}
          fill="#f1f5f9"
          stroke={MUTED}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text x={40} y={269} fontSize={14} fill={MUTED} fontFamily="monospace">
          music · audio
        </text>
        <text x={244} y={269} fontSize={14} fill={MUTED} fontFamily="monospace">
          root-only, never nests
        </text>
      </svg>
    </Figure>
  );
}
