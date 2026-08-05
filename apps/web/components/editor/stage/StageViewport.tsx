"use client";

type Props = {
  projectName: string;
  width: number;
  height: number;
};

export function StageViewport({ projectName, width, height }: Props) {
  return (
    <main
      className="editor-area-stage relative flex min-h-0 flex-col items-center justify-center overflow-hidden bg-[var(--stage-bg)]"
      data-testid="editor-stage"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(235,230,220,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(235,230,220,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div
        className="relative z-[1] flex flex-col items-center justify-center rounded-[var(--radius)] border border-[var(--border-strong)] bg-[#0a0908] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        style={{
          width: "min(72%, 720px)",
          aspectRatio: `${width} / ${height}`,
          maxHeight: "78%",
        }}
        data-testid="editor-stage-frame"
      >
        <p
          className="text-[18px] font-semibold tracking-tight text-[var(--fg-primary)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {projectName}
        </p>
        <p className="mt-2 max-w-[18rem] text-center text-[12px] leading-relaxed text-[var(--fg-muted)]">
          Remotion Player + RenderSnapshot sẽ gắn tại đây (PR2). Overlay hit-test
          nằm ngoài composition (PR3).
        </p>
        <p className="mt-4 text-[10px] uppercase tracking-[0.14em] text-[var(--accent-text)]">
          {width} × {height}
        </p>
      </div>
    </main>
  );
}
