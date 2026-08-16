import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/**
 * Video trim concept: layer timing on the timeline vs trimStart/trimEnd
 * cutting the source media. Two different clocks.
 */
export function VideoTrimFigure() {
  return (
    <Figure
      label="payload.trimStart / trimEnd"
      caption="Two different clocks: timing.start/duration place the layer on the timeline; trimStart/trimEnd choose which part of the source media plays."
    >
      <svg
        viewBox="0 0 640 240"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Video trim vs timing"
      >
        {/* source media bar */}
        <text x={48} y={52} fontSize={13} fill={MUTED} fontFamily="monospace">
          source media
        </text>
        <rect
          x={48}
          y={66}
          width={544}
          height={34}
          rx={6}
          fill="#f1f5f9"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <rect
          x={184}
          y={66}
          width={272}
          height={34}
          rx={6}
          fill={ACCENT}
          opacity={0.8}
        />
        <text
          x={320}
          y={88}
          textAnchor="middle"
          fontSize={12}
          fill="#fff"
          fontFamily="monospace"
        >
          plays: trimStart → trimEnd
        </text>
        <text
          x={184}
          y={120}
          textAnchor="middle"
          fontSize={12}
          fill={INK}
          fontFamily="monospace"
        >
          trimStart
        </text>
        <text
          x={456}
          y={120}
          textAnchor="middle"
          fontSize={12}
          fill={INK}
          fontFamily="monospace"
        >
          trimEnd
        </text>

        {/* timeline lane */}
        <text x={48} y={166} fontSize={13} fill={MUTED} fontFamily="monospace">
          timeline (project clock)
        </text>
        <rect
          x={48}
          y={180}
          width={544}
          height={34}
          rx={6}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <rect
          x={116}
          y={186}
          width={204}
          height={22}
          rx={5}
          fill={ACCENT}
          opacity={0.5}
        />
        <text
          x={218}
          y={201}
          textAnchor="middle"
          fontSize={12}
          fill={INK}
          fontFamily="monospace"
        >
          timing: start · duration
        </text>
        <text x={48} y={230} fontSize={12} fill={MUTED} fontFamily="monospace">
          0s
        </text>
      </svg>
    </Figure>
  );
}
