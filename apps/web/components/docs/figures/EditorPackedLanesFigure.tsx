import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/**
 * Web editor main view: several root layers packed on one visual lane.
 * Protocol JSON still has unique sibling zIndex — this is a projection, not a track list.
 */
export function EditorPackedLanesFigure() {
  return (
    <Figure
      label="editor main view"
      caption="Packed rows are editor chrome. JSON still has four roots with unique zIndex. Sharing a lane never means sharing zIndex."
    >
      <svg
        viewBox="0 0 640 220"
        className="w-full max-w-[560px]"
        role="img"
        aria-label="Editor main view packing root layers onto visual lanes"
      >
        <text x={24} y={22} fontSize={12} fill={MUTED} fontFamily="monospace">
          visual lane
        </text>
        <rect
          x={120}
          y={8}
          width={200}
          height={36}
          rx={8}
          fill="#ccfbf1"
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <text x={132} y={30} fontSize={13} fill={INK} fontFamily="monospace">
          video-a · z 0
        </text>
        <rect
          x={328}
          y={8}
          width={210}
          height={36}
          rx={8}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text x={340} y={30} fontSize={13} fill={INK} fontFamily="monospace">
          hero · group · z 1
        </text>

        <text x={24} y={78} fontSize={12} fill={MUTED} fontFamily="monospace">
          overlay
        </text>
        <rect
          x={200}
          y={62}
          width={180}
          height={36}
          rx={8}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text x={212} y={84} fontSize={13} fill={INK} fontFamily="monospace">
          title · text · z 2
        </text>

        <text x={24} y={132} fontSize={12} fill={MUTED} fontFamily="monospace">
          audio
        </text>
        <rect
          x={120}
          y={116}
          width={418}
          height={36}
          rx={8}
          fill="#f1f5f9"
          stroke={MUTED}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text x={132} y={138} fontSize={13} fill={MUTED} fontFamily="monospace">
          music · audio · z −1
        </text>

        <text x={24} y={188} fontSize={12} fill={MUTED} fontFamily="monospace">
          protocol
        </text>
        <text x={120} y={188} fontSize={13} fill={INK} fontFamily="monospace">
          four root layers · unique sibling zIndex · no tracks[]
        </text>
      </svg>
    </Figure>
  );
}
