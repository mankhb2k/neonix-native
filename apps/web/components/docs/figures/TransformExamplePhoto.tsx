import type { ReactNode } from "react";
import { DOCS_ASSET_PHOTO_SQUARE } from "@/lib/docs/visual-fixtures";

/** 1:1 photo tile used in Transform / Appearance Example sections. */
export function TransformExamplePhoto({
  label,
  transform,
  origin = "center",
  opacity,
  hidden = false,
  clipPath,
}: {
  label: string;
  transform?: string;
  origin?: string;
  /** 0..100. */
  opacity?: number;
  hidden?: boolean;
  clipPath?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="overflow-hidden border border-dashed border-[#94a3b8] bg-white"
        style={{ width: 96, height: 96 }}
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
            }}
          />
        )}
      </div>
      <p className="font-mono text-[10px] text-[#94a3b8]">{label}</p>
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
