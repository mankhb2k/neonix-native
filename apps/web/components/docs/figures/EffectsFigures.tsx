import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

function Card({
  x,
  y,
  filter,
  label,
}: {
  x: number;
  y: number;
  filter?: string;
  label: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={110}
        height={80}
        rx={10}
        fill="#ccfbf1"
        stroke={ACCENT}
        strokeWidth={2}
        filter={filter}
      />
      <text
        x={x + 55}
        y={y + 46}
        textAnchor="middle"
        fontSize={13}
        fontWeight={600}
        fill={INK}
        fontFamily="monospace"
      >
        {label}
      </text>
    </g>
  );
}

/** blur: same card at three radii. */
export function BlurFigure() {
  return (
    <Figure
      label='effects[].type = "blur"'
      caption="Blur softens this layer's own pixels. One field: radius. No direction, no inner/outer, no radiusX/radiusY."
    >
      <svg
        viewBox="0 0 640 200"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Blur"
      >
        <defs>
          <filter id="fx-b0">
            <feGaussianBlur stdDeviation={0} />
          </filter>
          <filter id="fx-b1">
            <feGaussianBlur stdDeviation={2.5} />
          </filter>
          <filter id="fx-b2">
            <feGaussianBlur stdDeviation={6} />
          </filter>
        </defs>
        <Card x={60} y={50} filter="url(#fx-b0)" label="radius 0" />
        <Card x={265} y={50} filter="url(#fx-b1)" label="radius 6" />
        <Card x={470} y={50} filter="url(#fx-b2)" label="radius 12" />
        <text
          x={320}
          y={170}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          animate effects.&lt;id&gt;.radius — linear
        </text>
      </svg>
    </Figure>
  );
}

/** shadow: outer drop shadow with offset direction. */
export function ShadowFigure() {
  return (
    <Figure
      label='effects[].type = "shadow"'
      caption="Outer drop shadow. Direction comes from offset.x / offset.y. No inner shadow, spread, angle, or distance in V1."
    >
      <svg
        viewBox="0 0 640 200"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Shadow"
      >
        <defs>
          <filter id="fx-sh1" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow
              dx={8}
              dy={12}
              stdDeviation={8}
              floodColor="#000"
              floodOpacity={0.25}
            />
          </filter>
          <filter id="fx-sh2" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow
              dx={-14}
              dy={6}
              stdDeviation={4}
              floodColor="#000"
              floodOpacity={0.4}
            />
          </filter>
        </defs>
        <Card x={120} y={50} label="no shadow" />
        <Card x={300} y={50} filter="url(#fx-sh1)" label="offset 8, 12" />
        <Card x={480} y={50} filter="url(#fx-sh2)" label="offset -14, 6" />
        <text
          x={320}
          y={170}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          opacity 0..100 (default 25) · blur · color
        </text>
      </svg>
    </Figure>
  );
}

/** glow: even outer halo around the silhouette. */
export function GlowFigure() {
  return (
    <Figure
      label='effects[].type = "glow"'
      caption="Outer glow — an even halo around the silhouette. Strength is opacity (0..100); there is no intensity field. Inner glow is a separate type."
    >
      <svg
        viewBox="0 0 640 200"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Glow"
      >
        <defs>
          <filter id="fx-gl1" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow
              dx={0}
              dy={0}
              stdDeviation={10}
              floodColor="#14b8a6"
              floodOpacity={0.8}
            />
          </filter>
          <filter id="fx-gl2" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow
              dx={0}
              dy={0}
              stdDeviation={18}
              floodColor="#f59e0b"
              floodOpacity={0.9}
            />
          </filter>
        </defs>
        <Card x={120} y={50} label="no glow" />
        <Card x={300} y={50} filter="url(#fx-gl1)" label="radius 16" />
        <Card x={480} y={50} filter="url(#fx-gl2)" label="radius 28" />
        <text
          x={320}
          y={170}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          animate radius and opacity — never color
        </text>
      </svg>
    </Figure>
  );
}

/** color-adjust: same image graded differently. */
export function ColorAdjustFigure() {
  return (
    <Figure
      label='effects[].type = "color-adjust"'
      caption="Pixel color grade on this layer. Identity is 100/100/100 and hue-rotate 0. A stack-wide grade is the adjustment layer, not this effect."
    >
      <svg
        viewBox="0 0 640 200"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Color adjust"
      >
        {[
          { label: "identity", filter: "none" },
          { label: "saturation 160", filter: "saturate(1.6)" },
          { label: "hue-rotate 120", filter: "hue-rotate(120deg)" },
        ].map((v, i) => (
          <g key={v.label} transform={`translate(${60 + i * 205} 50)`}>
            <rect
              x={0}
              y={0}
              width={120}
              height={80}
              rx={8}
              fill="#dbeafe"
              style={{ filter: v.filter }}
            />
            <circle
              cx={94}
              cy={20}
              r={9}
              fill="#fbbf24"
              style={{ filter: v.filter }}
            />
            <path
              d="M0 80 L34 40 L58 62 L78 46 L120 80 Z"
              fill="#34d399"
              style={{ filter: v.filter }}
            />
            <rect
              x={0}
              y={0}
              width={120}
              height={80}
              rx={8}
              fill="none"
              stroke={MUTED}
              strokeWidth={1.5}
            />
            <text
              x={60}
              y={108}
              textAnchor="middle"
              fontSize={12}
              fill={INK}
              fontFamily="monospace"
            >
              {v.label}
            </text>
          </g>
        ))}
        <text
          x={320}
          y={185}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          brightness · contrast · saturation 0..200 · hue-rotate −180..180
        </text>
      </svg>
    </Figure>
  );
}

/** inner-glow: even halo inside the silhouette. */
export function InnerGlowFigure() {
  return (
    <Figure
      label='effects[].type = "inner-glow"'
      caption="Inward halo along the silhouette. Own type — not a flag on glow. No intensity, spread, or choke. Bounds do not inflate."
    >
      <svg
        viewBox="0 0 640 200"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Inner glow"
      >
        <defs>
          <filter id="fx-ig1" x="-10%" y="-10%" width="120%" height="120%">
            <feFlood floodColor="#A855FF" floodOpacity="0.85" result="flood" />
            <feComposite
              in="flood"
              in2="SourceAlpha"
              operator="out"
              result="inverse"
            />
            <feGaussianBlur in="inverse" stdDeviation="3" result="blur" />
            <feComposite in="blur" in2="SourceAlpha" operator="in" />
          </filter>
          <filter id="fx-ig2" x="-10%" y="-10%" width="120%" height="120%">
            <feFlood floodColor="#A855FF" floodOpacity="0.9" result="flood" />
            <feComposite
              in="flood"
              in2="SourceAlpha"
              operator="out"
              result="inverse"
            />
            <feGaussianBlur in="inverse" stdDeviation="7" result="blur" />
            <feComposite in="blur" in2="SourceAlpha" operator="in" />
          </filter>
        </defs>
        <Card x={60} y={50} label="none" />
        <Card x={265} y={50} filter="url(#fx-ig1)" label="radius 8" />
        <Card x={470} y={50} filter="url(#fx-ig2)" label="radius 18" />
        <text
          x={320}
          y={170}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          animate radius and opacity — never color or intensity
        </text>
      </svg>
    </Figure>
  );
}

/** noise: grain overlay. */
export function NoiseFigure() {
  return (
    <Figure
      label='effects[].type = "noise"'
      caption="Grain on this layer's opaque pixels. Not a default full-screen grain. No seed, displacement, glitch, chromatic, or scanline."
    >
      <svg
        viewBox="0 0 640 200"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Noise"
      >
        <defs>
          <filter id="fx-n1">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.7"
              numOctaves="2"
              seed="2"
              result="n"
            />
            <feColorMatrix type="saturate" values="0" in="n" result="g" />
            <feBlend in="SourceGraphic" in2="g" mode="overlay" />
          </filter>
          <filter id="fx-n2">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.55"
              numOctaves="3"
              seed="2"
              result="n"
            />
            <feColorMatrix type="saturate" values="0" in="n" result="g" />
            <feBlend in="SourceGraphic" in2="g" mode="overlay" />
          </filter>
        </defs>
        <Card x={60} y={50} label="amount 0" />
        <Card x={265} y={50} filter="url(#fx-n1)" label="amount 12" />
        <Card x={470} y={50} filter="url(#fx-n2)" label="amount 40" />
        <text
          x={320}
          y={170}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          animate amount, scale, opacity — not animated
        </text>
      </svg>
    </Figure>
  );
}
