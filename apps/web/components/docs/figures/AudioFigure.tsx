import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/**
 * Audio concept: a root-only timeline lane with a waveform, fadeIn/fadeOut
 * ramps on the volume envelope, and trim on the source — never a visual box.
 */
export function AudioFigure() {
  // deterministic pseudo-waveform bars
  const bars: number[] = [];
  for (let i = 0; i < 64; i++) {
    const v = Math.sin(i * 0.7) * 0.5 + Math.sin(i * 1.9) * 0.3 + 0.55;
    bars.push(Math.max(0.12, Math.min(1, v)));
  }
  return (
    <Figure
      label='type: "audio" — root-only lane'
      caption="Audio is a timeline object, not a visual primitive: no frame, no transform, no appearance. trimStart/trimEnd cut the source; fadeIn/fadeOut shape the volume; zIndex is negative."
    >
      <svg
        viewBox="0 0 640 220"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Audio lane with waveform and fades"
      >
        {/* lane */}
        <rect
          x={40}
          y={60}
          width={560}
          height={88}
          rx={10}
          fill="#f8fafc"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text x={56} y={52} fontSize={13} fill={MUTED} fontFamily="monospace">
          music · audio · zIndex -1
        </text>

        {/* trim region */}
        <rect
          x={140}
          y={72}
          width={360}
          height={64}
          rx={6}
          fill="#ccfbf1"
          fillOpacity={0.45}
        />

        {/* waveform bars */}
        {bars.map((v, i) => {
          const x = 148 + i * 5.4;
          const h = v * 44;
          return (
            <rect
              key={i}
              x={x}
              y={104 - h / 2}
              width={3}
              height={h}
              rx={1.5}
              fill={ACCENT}
            />
          );
        })}

        {/* fade ramps */}
        <path
          d="M140 136 L196 72"
          stroke={INK}
          strokeWidth={1.2}
          strokeDasharray="4 3"
          fill="none"
        />
        <path
          d="M444 72 L500 136"
          stroke={INK}
          strokeWidth={1.2}
          strokeDasharray="4 3"
          fill="none"
        />
        <text x={150} y={160} fontSize={12} fill={INK} fontFamily="monospace">
          fadeIn
        </text>
        <text x={462} y={160} fontSize={12} fill={INK} fontFamily="monospace">
          fadeOut
        </text>

        {/* trim handles */}
        <line x1={140} y1={66} x2={140} y2={142} stroke={INK} strokeWidth={2} />
        <line x1={500} y1={66} x2={500} y2={142} stroke={INK} strokeWidth={2} />
        <text
          x={140}
          y={188}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          trimStart
        </text>
        <text
          x={500}
          y={188}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          trimEnd
        </text>

        {/* no visual fields */}
        <text x={40} y={212} fontSize={12} fill={MUTED} fontFamily="monospace">
          no frame · no transform · no appearance
        </text>
      </svg>
    </Figure>
  );
}
