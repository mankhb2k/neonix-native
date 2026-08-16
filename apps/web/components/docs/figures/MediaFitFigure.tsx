import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

function Landscape({ clipId }: { clipId: string }) {
  return (
    <>
      <clipPath id={clipId}>
        <rect x={0} y={0} width={120} height={76} rx={4} />
      </clipPath>
      <rect x={0} y={0} width={120} height={76} fill="#dbeafe" />
      <circle cx={96} cy={18} r={11} fill="#fbbf24" />
      <path d="M0 76 L34 34 L62 60 L84 42 L120 76 Z" fill="#34d399" />
    </>
  );
}

/**
 * Media fit concept: the same source asset placed in a fixed frame with the
 * four fit values — contain, cover, fill, none. Used by image, video, svg.
 */
export function MediaFitFigure({
  label = "payload.fit",
  caption = "One asset, one frame — fit decides how the source sits inside the box. cover is the default for image and video; contain is the default for svg.",
}: {
  label?: string;
  caption?: string;
}) {
  return (
    <Figure label={label} caption={caption}>
      <svg
        viewBox="0 0 640 200"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Media fit modes"
      >
        {/* contain */}
        <g transform="translate(24 30)">
          <rect
            x={0}
            y={0}
            width={120}
            height={76}
            fill="none"
            stroke={MUTED}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <g transform="translate(10 0) scale(0.833)">
            <Landscape clipId="mf-c" />
          </g>
          <text
            x={60}
            y={104}
            textAnchor="middle"
            fontSize={13}
            fill={INK}
            fontFamily="monospace"
          >
            contain
          </text>
          <text
            x={60}
            y={122}
            textAnchor="middle"
            fontSize={11}
            fill={MUTED}
            fontFamily="monospace"
          >
            fits inside
          </text>
        </g>

        {/* cover */}
        <g transform="translate(188 30)">
          <rect
            x={0}
            y={0}
            width={120}
            height={76}
            fill="none"
            stroke={ACCENT}
            strokeWidth={2}
          />
          <g transform="translate(-15 0) scale(1.25)">
            <g clipPath="url(#mf-v)">
              <Landscape clipId="mf-v" />
            </g>
          </g>
          <text
            x={60}
            y={104}
            textAnchor="middle"
            fontSize={13}
            fill={INK}
            fontFamily="monospace"
          >
            cover
          </text>
          <text
            x={60}
            y={122}
            textAnchor="middle"
            fontSize={11}
            fill={MUTED}
            fontFamily="monospace"
          >
            fills, may crop
          </text>
        </g>

        {/* fill */}
        <g transform="translate(352 30)">
          <rect
            x={0}
            y={0}
            width={120}
            height={76}
            fill="none"
            stroke={MUTED}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <g transform="scale(1 0.76) translate(0 12)">
            <Landscape clipId="mf-f" />
          </g>
          <text
            x={60}
            y={104}
            textAnchor="middle"
            fontSize={13}
            fill={INK}
            fontFamily="monospace"
          >
            fill
          </text>
          <text
            x={60}
            y={122}
            textAnchor="middle"
            fontSize={11}
            fill={MUTED}
            fontFamily="monospace"
          >
            stretches
          </text>
        </g>

        {/* none */}
        <g transform="translate(516 30)">
          <rect
            x={0}
            y={0}
            width={120}
            height={76}
            fill="none"
            stroke={MUTED}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <g transform="translate(6 14) scale(0.55)">
            <Landscape clipId="mf-n" />
          </g>
          <text
            x={60}
            y={104}
            textAnchor="middle"
            fontSize={13}
            fill={INK}
            fontFamily="monospace"
          >
            none
          </text>
          <text
            x={60}
            y={122}
            textAnchor="middle"
            fontSize={11}
            fill={MUTED}
            fontFamily="monospace"
          >
            no auto fit
          </text>
        </g>
      </svg>
    </Figure>
  );
}
