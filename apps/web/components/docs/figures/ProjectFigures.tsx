import { Figure } from "@/components/docs/figures/Figure";

const ACCENT = "var(--accent, #0d9488)";
const MUTED = "#94a3b8";
const INK = "#334155";

/** Project: one JSON file = one video; envelope blocks vs content. */
export function ProjectMapFigure() {
  const blocks = [
    { label: "metadata", y: 30 },
    { label: "composition", y: 62 },
    { label: "timeline", y: 94 },
    { label: "assets[]", y: 126 },
  ];
  return (
    <Figure
      label="MotionProjectV1"
      caption="One JSON file is one video. composition decides the canvas, timeline decides the clock — the picture and motion live in layers[]."
    >
      <svg
        viewBox="0 0 640 260"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Project blocks"
      >
        <rect
          x={40}
          y={16}
          width={260}
          height={228}
          rx={12}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text x={58} y={14} fontSize={12} fill={MUTED} fontFamily="monospace">
          project file
        </text>
        {blocks.map((b) => (
          <g key={b.label}>
            <rect
              x={56}
              y={b.y}
              width={228}
              height={26}
              rx={6}
              fill="#f8fafc"
              stroke={MUTED}
              strokeWidth={1}
            />
            <text
              x={70}
              y={b.y + 18}
              fontSize={12}
              fill={INK}
              fontFamily="monospace"
            >
              {b.label}
            </text>
          </g>
        ))}
        {/* layers highlighted */}
        <rect
          x={56}
          y={158}
          width={228}
          height={70}
          rx={8}
          fill="#ccfbf1"
          fillOpacity={0.4}
          stroke={ACCENT}
          strokeWidth={2}
        />
        <text
          x={70}
          y={180}
          fontSize={12}
          fontWeight={600}
          fill={INK}
          fontFamily="monospace"
        >
          layers[]
        </text>
        <text x={70} y={200} fontSize={11} fill={MUTED} fontFamily="monospace">
          picture · text · motion
        </text>

        {/* outputs */}
        <line
          x1={300}
          y1={75}
          x2={380}
          y2={75}
          stroke={MUTED}
          strokeWidth={1.3}
          markerEnd="url(#pm-a)"
        />
        <line
          x1={300}
          y1={107}
          x2={380}
          y2={107}
          stroke={MUTED}
          strokeWidth={1.3}
          markerEnd="url(#pm-a)"
        />
        <defs>
          <marker
            id="pm-a"
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
              strokeWidth={1.3}
            />
          </marker>
        </defs>
        <rect
          x={388}
          y={48}
          width={200}
          height={44}
          rx={8}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text
          x={488}
          y={75}
          textAnchor="middle"
          fontSize={12}
          fill={INK}
          fontFamily="monospace"
        >
          composition → canvas
        </text>
        <rect
          x={388}
          y={100}
          width={200}
          height={44}
          rx={8}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text
          x={488}
          y={127}
          textAnchor="middle"
          fontSize={12}
          fill={INK}
          fontFamily="monospace"
        >
          timeline → MP4 length
        </text>
      </svg>
    </Figure>
  );
}

/** Composition: the output canvas, distinct from a layer's frame. */
export function CompositionFigure() {
  return (
    <Figure
      label="composition"
      caption="composition is the output frame — with timeline.duration it decides the MP4. A layer's own box is frame; the two sizes are independent."
    >
      <svg
        viewBox="0 0 640 280"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Composition vs frame"
      >
        {/* composition canvas */}
        <rect
          x={150}
          y={20}
          width={300}
          height={220}
          rx={10}
          fill="#fff"
          stroke={ACCENT}
          strokeWidth={2}
        />
        <text
          x={170}
          y={46}
          fontSize={13}
          fontWeight={600}
          fill={ACCENT}
          fontFamily="monospace"
        >
          composition 1080×1920
        </text>
        {/* a small layer frame inside */}
        <rect
          x={210}
          y={110}
          width={180}
          height={60}
          rx={6}
          fill="#ccfbf1"
          fillOpacity={0.5}
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text
          x={300}
          y={146}
          textAnchor="middle"
          fontSize={12}
          fill={INK}
          fontFamily="monospace"
        >
          layer frame 400×120
        </text>
        {/* dimension notes */}
        <text x={480} y={130} fontSize={12} fill={MUTED} fontFamily="monospace">
          width · height · fps
        </text>
        <text x={480} y={150} fontSize={12} fill={MUTED} fontFamily="monospace">
          background · colorSpace
        </text>
        <text
          x={300}
          y={268}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="monospace"
        >
          composition.width ≠ frame.width
        </text>
      </svg>
    </Figure>
  );
}

/** Assets: a registry; layers reference ids, not raw URLs. */
export function AssetsFigure() {
  return (
    <Figure
      label="assets[]"
      caption="Layers point at payload.assetId. The file lives once in the assets registry — upload first (or use a fixture uri), then reference the id."
    >
      <svg
        viewBox="0 0 640 230"
        className="w-full max-w-[576px]"
        role="img"
        aria-label="Assets registry"
      >
        <defs>
          <marker
            id="as-a"
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
        {/* registry */}
        <rect
          x={40}
          y={30}
          width={250}
          height={170}
          rx={12}
          fill="#fff"
          stroke={MUTED}
          strokeWidth={1.5}
        />
        <text
          x={58}
          y={58}
          fontSize={13}
          fontWeight={600}
          fill={INK}
          fontFamily="monospace"
        >
          assets[]
        </text>
        {["img_hero · image", "bgm · audio", "font_inter · font"].map(
          (a, i) => (
            <g key={a}>
              <rect
                x={58}
                y={72 + i * 38}
                width={214}
                height={28}
                rx={6}
                fill="#f8fafc"
                stroke={MUTED}
                strokeWidth={1}
              />
              <text
                x={70}
                y={90 + i * 38}
                fontSize={12}
                fill={INK}
                fontFamily="monospace"
              >
                {a}
              </text>
            </g>
          ),
        )}
        {/* layer referencing */}
        <rect
          x={400}
          y={80}
          width={200}
          height={64}
          rx={10}
          fill="#ffffff"
          stroke={ACCENT}
          strokeWidth={2}
        />
        <text
          x={418}
          y={106}
          fontSize={12}
          fontWeight={600}
          fill={INK}
          fontFamily="monospace"
        >
          photo · image layer
        </text>
        <text x={418} y={126} fontSize={11} fill={INK} fontFamily="monospace">
          payload.assetId
        </text>
        <line
          x1={398}
          y1={100}
          x2={292}
          y2={86}
          stroke={ACCENT}
          strokeWidth={1.4}
          strokeDasharray="5 4"
          markerEnd="url(#as-a)"
        />
      </svg>
    </Figure>
  );
}

/** Validation: the gate sequence before compile. */
export function ValidationFigure() {
  const steps = [
    "Normalize text",
    "Schema (.strict)",
    "Reference ids",
    "Compile",
  ];
  return (
    <Figure
      label="validation order"
      caption="Wrong JSON stops before compile. Preview and export only run after the project parses — a broken preview is not a validation result."
    >
      <svg
        viewBox="0 0 640 160"
        className="w-full max-w-[640px]"
        role="img"
        aria-label="Validation order"
      >
        <defs>
          <marker
            id="va-a"
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
              strokeWidth={1.3}
            />
          </marker>
        </defs>
        {steps.map((s, i) => {
          const x = 24 + i * 154;
          const last = i === steps.length - 1;
          return (
            <g key={s}>
              <rect
                x={x}
                y={50}
                width={130}
                height={52}
                rx={10}
                fill="#ffffff"
                stroke={last ? ACCENT : MUTED}
                strokeWidth={last ? 2 : 1.5}
              />
              <text
                x={x + 65}
                y={81}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                fill={INK}
                fontFamily="monospace"
              >
                {s}
              </text>
              {!last ? (
                <line
                  x1={x + 134}
                  y1={76}
                  x2={x + 150}
                  y2={76}
                  stroke={MUTED}
                  strokeWidth={1.3}
                  markerEnd="url(#va-a)"
                />
              ) : null}
            </g>
          );
        })}
        <text x={24} y={140} fontSize={12} fill={MUTED} fontFamily="monospace">
          any failure above stops the pipeline — nothing reaches compile
        </text>
      </svg>
    </Figure>
  );
}
