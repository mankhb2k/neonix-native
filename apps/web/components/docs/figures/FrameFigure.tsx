import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/**
 * Frame concept: the local size box of the layer itself, measured before
 * transform. Required on every visual layer; forbidden on audio and camera.
 */
export function FrameFigure() {
  return (
    <Figure
      label="layers[].frame"
      caption="frame is the layer's own width × height in local space, before translate / scale / rotate. Audio and camera must not have a frame."
    >
      <svg
        viewBox="0 0 640 280"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Frame"
      >
        {/* canvas — fills most of the stage, everything stays inside */}
        <rect
          x={24}
          y={16}
          width={592}
          height={248}
          rx={10}
          fill="#fff"
          stroke={MUTED}
          strokeDasharray="6 5"
        />
        <text x={44} y={44} fontSize={13} fill={MUTED} fontFamily="monospace">
          composition
        </text>

        {/* layer frame box — centered, with room for dimensions inside canvas */}
        <rect
          x={160}
          y={84}
          width={260}
          height={110}
          rx={6}
          fill="#ccfbf1"
          fillOpacity={0.4}
          stroke={ACCENT}
          strokeWidth={2}
        />

        {/* width dimension */}
        <line
          x1={160}
          y1={222}
          x2={420}
          y2={222}
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <line
          x1={160}
          y1={216}
          x2={160}
          y2={228}
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <line
          x1={420}
          y1={216}
          x2={420}
          y2={228}
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <text
          x={290}
          y={244}
          textAnchor="middle"
          fontSize={13}
          fill={ACCENT}
          fontFamily="monospace"
        >
          frame.width
        </text>

        {/* height dimension */}
        <line
          x1={448}
          y1={84}
          x2={448}
          y2={194}
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <line
          x1={442}
          y1={84}
          x2={454}
          y2={84}
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <line
          x1={442}
          y1={194}
          x2={454}
          y2={194}
          stroke={ACCENT}
          strokeWidth={1.5}
        />
        <text
          x={462}
          y={143}
          fontSize={13}
          fill={ACCENT}
          fontFamily="monospace"
        >
          frame.height
        </text>

        {/* local origin note — inside the dashed canvas */}
        <circle cx={160} cy={84} r={4} fill={INK} />
        <text x={172} y={76} fontSize={13} fill={INK} fontFamily="monospace">
          local space — before transform
        </text>
      </svg>
    </Figure>
  );
}
