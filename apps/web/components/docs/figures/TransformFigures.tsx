import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

const CANVAS = { x: 24, y: 16, w: 592, h: 248 };

function Canvas({ label }: { label: string }) {
  return (
    <>
      <rect
        x={CANVAS.x}
        y={CANVAS.y}
        width={CANVAS.w}
        height={CANVAS.h}
        rx={10}
        fill="#fff"
        stroke={MUTED}
        strokeDasharray="6 5"
      />
      <text
        x={CANVAS.x + 20}
        y={CANVAS.y + 28}
        fontSize={13}
        fill={MUTED}
        fontFamily="monospace"
      >
        {label}
      </text>
    </>
  );
}

/** Shared square "layer" glyph. */
function Box({
  x,
  y,
  size = 96,
  rotate = 0,
  skewX = 0,
  skewY = 0,
  dashed = false,
  label,
  labelY = 5,
}: {
  x: number;
  y: number;
  size?: number;
  rotate?: number;
  skewX?: number;
  skewY?: number;
  dashed?: boolean;
  label?: string;
  labelY?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${rotate}) skewX(${skewX}) skewY(${skewY})`}
    >
      <rect
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        rx={8}
        fill={dashed ? "none" : "#ccfbf1"}
        fillOpacity={dashed ? undefined : 0.45}
        stroke={dashed ? MUTED : ACCENT}
        strokeWidth={dashed ? 1.5 : 2}
        strokeDasharray={dashed ? "5 4" : undefined}
      />
      {label ? (
        <text
          x={0}
          y={labelY}
          textAnchor="middle"
          fontSize={13}
          fill={INK}
          fontFamily="monospace"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

export function TranslateFigure() {
  return (
    <Figure
      label="transform.translate"
      caption="translate.x / translate.y move the layer in composition pixels. There is no translate.z — use depth for near/far."
    >
      <svg
        viewBox="0 0 640 280"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Translate"
      >
        <Canvas label="composition" />
        <Box x={200} y={140} dashed label="before" labelY={-22} />
        <Box x={400} y={180} label="after" labelY={-22} />
        <line
          x1={200}
          y1={140}
          x2={400}
          y2={180}
          stroke={ACCENT}
          strokeWidth={1.5}
          markerEnd="url(#tr-a)"
        />
        <defs>
          <marker
            id="tr-a"
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
        <text
          x={300}
          y={108}
          textAnchor="middle"
          fontSize={13}
          fill={ACCENT}
          fontFamily="monospace"
        >
          translate.x, translate.y
        </text>
      </svg>
    </Figure>
  );
}

export function ScaleFigure() {
  return (
    <Figure
      label="transform.scale"
      caption="1 is the original size. Negative scale flips the axis — there is no flipX / flipY."
    >
      <svg
        viewBox="0 0 640 280"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Scale"
      >
        <Canvas label="scale around origin" />
        {/* scale 1 */}
        <Box x={170} y={140} label="1, 1" />
        {/* scale 1.5 */}
        <Box x={370} y={140} size={144} label="1.5, 1.5" />
        {/* flipped */}
        <g transform="translate(530 140) scale(-1 1)">
          <rect
            x={-48}
            y={-48}
            width={96}
            height={96}
            rx={8}
            fill="#ccfbf1"
            fillOpacity={0.45}
            stroke={ACCENT}
            strokeWidth={2}
          />
        </g>
        <text
          x={530}
          y={145}
          textAnchor="middle"
          fontSize={13}
          fill={INK}
          fontFamily="monospace"
        >
          -1, 1
        </text>
        <text
          x={530}
          y={216}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          flip horizontal
        </text>
        {/* origin dots */}
        <circle cx={170} cy={140} r={4} fill={INK} />
        <circle cx={370} cy={140} r={4} fill={INK} />
      </svg>
    </Figure>
  );
}

export function RotateFigure() {
  return (
    <Figure
      label="transform.rotate.z"
      caption="2D rotation around Z, in degrees, pivoting at origin. No rotate.x or rotate.y in V1."
    >
      <svg
        viewBox="0 0 640 280"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Rotate"
      >
        <Canvas label="rotate around origin" />
        <Box x={240} y={150} dashed />
        <Box x={240} y={150} rotate={35} />
        <circle cx={240} cy={150} r={5} fill="#fff" stroke={ACCENT} strokeWidth={2} />
        <path
          d="M 320 150 A 80 80 0 0 0 296 96"
          fill="none"
          stroke={MUTED}
          strokeWidth={1.5}
          markerEnd="url(#rt-a)"
        />
        <defs>
          <marker
            id="rt-a"
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
              strokeWidth={1.5}
            />
          </marker>
        </defs>
        <text x={330} y={110} fontSize={13} fill={MUTED} fontFamily="monospace">
          rotate.z
        </text>
        <text x={440} y={145} fontSize={13} fill={INK} fontFamily="monospace">
          pivot = origin
        </text>
        <line
          x1={430}
          y1={148}
          x2={280}
          y2={150}
          stroke={MUTED}
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      </svg>
    </Figure>
  );
}

export function SkewFigure() {
  return (
    <Figure
      label="transform.skew"
      caption="Shear in degrees around origin. skew.x slants horizontally; skew.y slants vertically. Applies after scale / rotate."
    >
      <svg
        viewBox="0 0 640 280"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Skew"
      >
        <Canvas label="skew around origin" />
        <Box x={140} y={130} />
        <text
          x={140}
          y={214}
          textAnchor="middle"
          fontSize={12}
          fill={INK}
          fontFamily="monospace"
        >
          0, 0
        </text>
        <Box x={320} y={130} skewX={20} />
        <text
          x={320}
          y={214}
          textAnchor="middle"
          fontSize={12}
          fill={INK}
          fontFamily="monospace"
        >
          skew.x 20
        </text>
        <Box x={500} y={130} skewY={16} />
        <text
          x={500}
          y={214}
          textAnchor="middle"
          fontSize={12}
          fill={INK}
          fontFamily="monospace"
        >
          skew.y 16
        </text>
      </svg>
    </Figure>
  );
}

export function OriginFigure() {
  const points = [
    { x: 0, y: 0, lx: "0, 0" },
    { x: 0.5, y: 0, lx: "0.5, 0" },
    { x: 1, y: 0, lx: "1, 0" },
    { x: 0, y: 0.5, lx: "0, 0.5" },
    { x: 0.5, y: 0.5, lx: "0.5, 0.5" },
    { x: 1, y: 0.5, lx: "1, 0.5" },
    { x: 0, y: 1, lx: "0, 1" },
    { x: 0.5, y: 1, lx: "0.5, 1" },
    { x: 1, y: 1, lx: "1, 1" },
  ];
  const bx = 220;
  const by = 60;
  const bw = 200;
  const bh = 160;
  return (
    <Figure
      label="transform.origin"
      caption="Normalized pivot inside the local frame: 0,0 top-left · 0.5,0.5 center · 1,1 bottom-right. AI should prefer 0, 0.5, or 1."
    >
      <svg
        viewBox="0 0 640 280"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Origin"
      >
        <Canvas label="local frame" />
        <rect
          x={bx}
          y={by}
          width={bw}
          height={bh}
          rx={8}
          fill="#ccfbf1"
          fillOpacity={0.4}
          stroke={ACCENT}
          strokeWidth={2}
        />
        {points.map((p) => {
          const cx = bx + p.x * bw;
          const cy = by + p.y * bh;
          const center = p.x === 0.5 && p.y === 0.5;
          return (
            <g key={p.lx}>
              <circle
                cx={cx}
                cy={cy}
                r={center ? 7 : 5}
                fill={center ? ACCENT : "#fff"}
                stroke={ACCENT}
                strokeWidth={2}
              />
              <text
                x={cx}
                y={cy - 12}
                textAnchor="middle"
                fontSize={11}
                fill={center ? ACCENT : MUTED}
                fontFamily="monospace"
              >
                {p.lx}
              </text>
            </g>
          );
        })}
      </svg>
    </Figure>
  );
}

export function DepthFigure() {
  return (
    <Figure
      label="transform.depth"
      caption="Near/far position for pseudo-3D and parallax. Depth never changes paint order — that is zIndex."
    >
      <svg
        viewBox="0 0 640 280"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Depth"
      >
        <Canvas label="depth ≠ zIndex" />
        {/* far plane */}
        <Box x={230} y={150} size={70} dashed />
        <text
          x={230}
          y={212}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          depth -200 · farther
        </text>
        {/* normal plane */}
        <Box x={390} y={150} size={100} label="0" />
        <text
          x={390}
          y={222}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          normal plane
        </text>
        {/* near plane */}
        <Box x={530} y={150} size={130} label="+120" />
        <text
          x={530}
          y={238}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          closer
        </text>
      </svg>
    </Figure>
  );
}
