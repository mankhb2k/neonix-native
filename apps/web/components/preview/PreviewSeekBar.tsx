"use client";

type PreviewSeekBarProps = {
  time: number;
  duration: number;
  step: number;
  onChange: (time: number) => void;
};

function progressPercent(time: number, duration: number): number {
  if (duration <= 0) return 0;
  return Math.min(100, Math.max(0, (time / duration) * 100));
}

export function PreviewSeekBar({ time, duration, step, onChange }: PreviewSeekBarProps) {
  const progress = progressPercent(time, duration);

  return (
    <div
      className="relative flex h-[14px] min-w-0 flex-1 items-center rounded-full"
      data-testid="preview-seek-bar"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-white/35"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-[var(--accent)]"
        style={{ width: `${progress}%` }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/2 size-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)]"
        style={{ left: `${progress}%` }}
        aria-hidden="true"
      />
      <input
        type="range"
        min={0}
        max={duration}
        step={step}
        value={Math.min(time, duration)}
        aria-label="Preview timeline"
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onChange(Number(event.target.value))}
        className="absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
