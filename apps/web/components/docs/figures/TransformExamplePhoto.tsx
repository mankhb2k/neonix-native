import type { ReactNode } from "react";
import { DOCS_ASSET_PHOTO_SQUARE } from "@/lib/docs/visual-fixtures";

/** 1:1 photo tile used in Transform / Appearance / Effects Example sections. */
export function TransformExamplePhoto({
  label,
  transform,
  origin = "center",
  opacity,
  hidden = false,
  clipPath,
  filter,
  boxShadow,
  insetBoxShadow,
  grain = 0,
}: {
  label: string;
  transform?: string;
  origin?: string;
  /** 0..100. */
  opacity?: number;
  hidden?: boolean;
  clipPath?: string;
  filter?: string;
  boxShadow?: string;
  insetBoxShadow?: string;
  /** 0..100 overlay grain for noise docs examples. */
  grain?: number;
}) {
  const outerOnly = Boolean(boxShadow) && !insetBoxShadow;
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative border border-dashed border-white/70 bg-[var(--bg-elevated)]"
        style={{
          width: 96,
          height: 96,
          overflow: outerOnly ? "visible" : "hidden",
        }}
      >
        {hidden ? null : (
          <img
            src={DOCS_ASSET_PHOTO_SQUARE.uri}
            alt={label}
            className="h-full w-full object-cover"
            style={{
              transform,
              transformOrigin: origin,
              opacity:
                opacity === undefined ? undefined : opacity / 100,
              clipPath,
              filter,
              boxShadow: insetBoxShadow ? undefined : boxShadow,
            }}
          />
        )}
        {insetBoxShadow ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ boxShadow: insetBoxShadow }}
          />
        ) : null}
        {grain > 0 ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 mix-blend-overlay"
            style={{
              opacity: Math.min(1, grain / 50),
              backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
                `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`,
              )}")`,
            }}
          />
        ) : null}
      </div>
      <p className="font-mono text-[10px] text-[var(--fg-muted)]">{label}</p>
    </div>
  );
}

export function TransformExampleRow({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex w-full max-w-[400px] items-start justify-center gap-6">
      {children}
    </div>
  );
}
