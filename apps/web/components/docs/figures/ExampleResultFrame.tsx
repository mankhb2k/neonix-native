import type { ReactNode } from "react";

/** Dashed frame + caption used in ExampleWithResult previews. */
export function ExampleResultFrame({
  children,
  caption,
  viewBox = "0 0 400 160",
  label,
}: {
  children: ReactNode;
  caption: string;
  viewBox?: string;
  label: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      className="w-full max-w-[320px]"
      role="img"
      aria-label={label}
    >
      {children}
      <text
        x="50%"
        y="94%"
        textAnchor="middle"
        fontSize={10}
        fill="#94a3b8"
        fontFamily="monospace"
      >
        {caption}
      </text>
    </svg>
  );
}
