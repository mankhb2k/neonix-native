import { cn } from "@/lib/utils";

/** SVG bar waveform from normalized energy values (0..1). */
export function Waveform({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  const width = 320;
  const height = 64;
  const gap = 2;
  const barWidth = Math.max(1, width / values.length - gap);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("block h-16 w-full", className)}
      preserveAspectRatio="none"
      aria-hidden
    >
      {values.map((value, i) => {
        const barHeight = Math.max(2, value * height);
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx="1"
            fill="var(--accent)"
            opacity={0.35 + value * 0.65}
          />
        );
      })}
    </svg>
  );
}
