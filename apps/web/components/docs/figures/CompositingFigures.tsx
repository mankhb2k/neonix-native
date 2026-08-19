import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

function LandscapeCard({
  x,
  y,
  opacity = 1,
}: {
  x: number;
  y: number;
  opacity?: number;
}) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <rect
        x={0}
        y={0}
        width={120}
        height={80}
        rx={8}
        fill="#dbeafe"
        stroke={MUTED}
        strokeWidth={1.5}
      />
      <circle cx={94} cy={20} r={9} fill="#fbbf24" />
      <path d="M0 80 L34 40 L58 62 L78 46 L120 80 Z" fill="#34d399" />
    </g>
  );
}

/** opacity: integer percent 0..100. */
export function OpacityFigure() {
  const steps = [100, 60, 20];
  return (
    <Figure
      label="opacity"
      caption="Opacity is an integer percent: 100 fully opaque, 0 invisible. Not a 0..1 float, and never on transform. Parent opacity multiplies down to children."
    >
      <svg
        viewBox="0 0 640 200"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Opacity"
      >
        {steps.map((v, i) => (
          <g key={v}>
            <LandscapeCard x={60 + i * 190} y={50} opacity={v / 100} />
            <text
              x={120 + i * 190}
              y={162}
              textAnchor="middle"
              fontSize={14}
              fontWeight={600}
              fill={INK}
              fontFamily="monospace"
            >
              opacity {v}
            </text>
          </g>
        ))}
      </svg>
    </Figure>
  );
}

/** visibility via opacity: 0 hides, 100 shows — the layer is either painted or not. */
export function VisibleFigure() {
  return (
    <Figure
      label="opacity (0 = hidden)"
      caption="visible is render on/off for visual layers. It is not hit-test, selection, or editor lock — and audio has no appearance at all."
    >
      <svg
        viewBox="0 0 640 190"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Visible"
      >
        {/* visible: true */}
        <g transform="translate(90 40)">
          <rect
            x={0}
            y={0}
            width={140}
            height={90}
            rx={10}
            fill="#ccfbf1"
            stroke={ACCENT}
            strokeWidth={2}
          />
          <text
            x={70}
            y={52}
            textAnchor="middle"
            fontSize={13}
            fontWeight={600}
            fill={INK}
            fontFamily="monospace"
          >
            painted
          </text>
          <text
            x={70}
            y={118}
            textAnchor="middle"
            fontSize={12}
            fill={INK}
            fontFamily="monospace"
          >
            visible: true
          </text>
        </g>
        {/* visible: false — slot reserved but nothing painted */}
        <g transform="translate(390 40)">
          <rect
            x={0}
            y={0}
            width={140}
            height={90}
            rx={10}
            fill="none"
            stroke={MUTED}
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <text
            x={70}
            y={52}
            textAnchor="middle"
            fontSize={12}
            fill={MUTED}
            fontFamily="monospace"
          >
            not painted
          </text>
          <text
            x={70}
            y={118}
            textAnchor="middle"
            fontSize={12}
            fill={MUTED}
            fontFamily="monospace"
          >
            visible: false
          </text>
        </g>
        <text
          x={320}
          y={176}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          opacity can stay 100 — nothing renders when visible is false
        </text>
      </svg>
    </Figure>
  );
}

/** compositing.blend-mode: the same two rects blended with different modes. */
export function BlendModeFigure() {
  const modes: Array<{ id: string; label: string }> = [
    { id: "normal", label: "normal" },
    { id: "multiply", label: "multiply" },
    { id: "screen", label: "screen" },
    { id: "overlay", label: "overlay" },
  ];
  return (
    <Figure
      label="compositing.blend-mode"
      caption="How this layer composites over what is already painted. Seven modes: normal, multiply, screen, add, darken, lighten, overlay. Default normal — omit the field."
    >
      <svg
        viewBox="0 0 640 200"
        className="w-full max-w-[640px]"
        role="img"
        aria-label="Blend modes"
      >
        {modes.map((m, i) => (
          <g key={m.id} transform={`translate(${24 + i * 156} 40)`}>
            <rect x={0} y={0} width={100} height={70} rx={8} fill="#60a5fa" />
            <rect
              x={34}
              y={26}
              width={100}
              height={70}
              rx={8}
              fill="#f59e0b"
              style={{ mixBlendMode: m.id as "normal" }}
            />
            <text
              x={67}
              y={122}
              textAnchor="middle"
              fontSize={13}
              fill={INK}
              fontFamily="monospace"
            >
              {m.label}
            </text>
          </g>
        ))}
      </svg>
    </Figure>
  );
}

/** compositing.isolation: isolate starts a new compositing group. */
export function IsolationFigure() {
  return (
    <Figure
      label="compositing.isolation"
      caption="Advanced. auto (default) lets blend/mask effects see everything painted below; isolate scopes them to a fresh group. AI should not emit it by default."
    >
      <svg
        viewBox="0 0 640 210"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Isolation"
      >
        {/* auto: blends with the backdrop */}
        <g transform="translate(50 30)">
          <rect
            x={0}
            y={0}
            width={220}
            height={110}
            rx={10}
            fill="#f8fafc"
            stroke={MUTED}
            strokeWidth={1.5}
          />
          <circle cx={70} cy={60} r={34} fill="#60a5fa" />
          <circle
            cx={110}
            cy={60}
            r={34}
            fill="#f59e0b"
            style={{ mixBlendMode: "multiply" }}
          />
          <text
            x={110}
            y={138}
            textAnchor="middle"
            fontSize={13}
            fill={INK}
            fontFamily="monospace"
          >
            auto (default)
          </text>
          <text
            x={110}
            y={156}
            textAnchor="middle"
            fontSize={11}
            fill={MUTED}
            fontFamily="monospace"
          >
            blends with the backdrop
          </text>
        </g>
        {/* isolate: fresh scope */}
        <g transform="translate(370 30)">
          <rect
            x={0}
            y={0}
            width={220}
            height={110}
            rx={10}
            fill="#f8fafc"
            stroke={ACCENT}
            strokeWidth={2}
          />
          <rect
            x={28}
            y={14}
            width={164}
            height={82}
            rx={8}
            fill="#fff"
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <circle cx={90} cy={55} r={28} fill="#60a5fa" />
          <circle
            cx={124}
            cy={55}
            r={28}
            fill="#f59e0b"
            style={{ mixBlendMode: "multiply" }}
          />
          <text
            x={110}
            y={138}
            textAnchor="middle"
            fontSize={13}
            fill={ACCENT}
            fontFamily="monospace"
          >
            isolate
          </text>
          <text
            x={110}
            y={156}
            textAnchor="middle"
            fontSize={11}
            fill={MUTED}
            fontFamily="monospace"
          >
            blend scoped to the dashed group
          </text>
        </g>
      </svg>
    </Figure>
  );
}

/** compositing.mask: a photo clipped by a shape mask source. */
export function MaskFigure() {
  return (
    <Figure
      label="compositing.mask"
      caption="Cut or reveal with an explicit mask source — never with group.frame. Default mode clip or alpha, source-visibility mask-only."
    >
      <svg
        viewBox="0 0 640 220"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Mask"
      >
        <defs>
          <clipPath id="mask-demo">
            <circle cx={160} cy={100} r={62} />
          </clipPath>
        </defs>

        {/* source layer */}
        <g transform="translate(60 30)">
          <circle
            cx={100}
            cy={70}
            r={62}
            fill="#ccfbf1"
            stroke={ACCENT}
            strokeWidth={2}
          />
          <text
            x={100}
            y={168}
            textAnchor="middle"
            fontSize={12}
            fill={MUTED}
            fontFamily="monospace"
          >
            mask source · shape
          </text>
        </g>

        {/* plus */}
        <text x={250} y={105} textAnchor="middle" fontSize={18} fill={MUTED}>
          +
        </text>

        {/* photo */}
        <g transform="translate(280 40)">
          <rect
            x={0}
            y={0}
            width={120}
            height={80}
            rx={8}
            fill="#dbeafe"
            stroke={MUTED}
            strokeWidth={1.5}
          />
          <circle cx={94} cy={20} r={9} fill="#fbbf24" />
          <path d="M0 80 L34 40 L58 62 L78 46 L120 80 Z" fill="#34d399" />
          <text
            x={60}
            y={108}
            textAnchor="middle"
            fontSize={12}
            fill={MUTED}
            fontFamily="monospace"
          >
            photo · image
          </text>
        </g>

        {/* equals */}
        <text x={432} y={105} textAnchor="middle" fontSize={18} fill={MUTED}>
          =
        </text>

        {/* result: photo clipped to circle */}
        <g transform="translate(400 0)">
          <g clipPath="url(#mask-demo)">
            <rect x={98} y={60} width={124} height={82} fill="#dbeafe" />
            <circle cx={196} cy={80} r={10} fill="#fbbf24" />
            <path
              d="M98 142 L134 100 L158 124 L180 106 L222 142 Z"
              fill="#34d399"
            />
          </g>
          <circle
            cx={160}
            cy={100}
            r={62}
            fill="none"
            stroke={ACCENT}
            strokeWidth={2}
          />
          <text
            x={160}
            y={196}
            textAnchor="middle"
            fontSize={12}
            fill={INK}
            fontFamily="monospace"
          >
            masked result
          </text>
        </g>
      </svg>
    </Figure>
  );
}
