"use client";

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{label}</span>
      <input
        type="color"
        className="h-7 w-12 appearance-none rounded border-2 border-[var(--border-strong)] bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:border-0"
        value={value.startsWith("#") ? value.slice(0, 7) : "#ffffff"}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      />
    </label>
  );
}
