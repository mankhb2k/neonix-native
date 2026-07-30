"use client";

import { KeyframeToggle } from "../KeyframeToggle/KeyframeToggle";
import { cn } from "@/lib/utils";

export interface SliderPropertyInputProps {
  id?: string;
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
  keyframeable?: boolean;
  isKeyframed?: boolean;
  onToggleKeyframe?: () => void;
  disabled?: boolean;
  className?: string;
}

export function SliderPropertyInput({
  id,
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "%",
  onChange,
  keyframeable = false,
  isKeyframed = false,
  onToggleKeyframe,
  disabled = false,
  className,
}: SliderPropertyInputProps) {
  return (
    <div className={cn("flex flex-col gap-1 min-w-0 flex-1", className)}>
      {label ? (
        <div className="flex items-center justify-between">
          <span className="text-caption text-[var(--fg-muted)]">{label}</span>
          {keyframeable ? (
            <KeyframeToggle
              active={isKeyframed}
              onClick={onToggleKeyframe}
              disabled={disabled}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        {/* Slider Input */}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--bg-hover,#262626)] accent-[var(--accent,#3B82F6)] disabled:opacity-40"
        />

        {/* Number Input box */}
        <div className="flex h-6 w-14 shrink-0 items-center rounded-[4px] bg-[var(--bg-hover,#262626)] px-1.5">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full min-w-0 bg-transparent text-right text-ui font-regular leading-none text-[var(--fg)] outline-none disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {unit ? (
            <span className="ml-0.5 text-[10px] text-[var(--fg-muted)] select-none">
              {unit}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
